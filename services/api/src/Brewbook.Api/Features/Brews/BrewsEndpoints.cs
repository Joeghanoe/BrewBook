using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Brewbook.Api.Features.Achievements;
using Microsoft.EntityFrameworkCore;

namespace Brewbook.Api.Features.Brews;

public static class BrewsEndpoints
{
    public static readonly string[] KnownDefects = ["Sour", "Bitter", "Thin", "Harsh"];

    public static RouteGroupBuilder MapBrews(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/brews");

        g.MapGet("/", async (Guid? beanId, int? limit, CurrentUser me, BrewbookDbContext db, CancellationToken ct) =>
        {
            var q = db.Brews.Include(b => b.FlavourTags).Where(b => b.UserId == me.Id);
            if (beanId is { } bid) q = q.Where(b => b.BeanId == bid);
            var take = Math.Clamp(limit ?? 100, 1, 500);
            var brews = await q.OrderByDescending(b => b.Number).Take(take).ToListAsync(ct);
            return Results.Ok(brews.Select(b => BrewResponse.From(b)));
        });

        g.MapPost("/", async (CreateBrewRequest req, CurrentUser me, BrewbookDbContext db, TimeProvider clock, AchievementService achievements, CancellationToken ct) =>
        {
            var errors = Validate(req);
            if (errors.Count > 0) return Results.ValidationProblem(errors);

            var beanExists = await db.Beans.AnyAsync(b => b.Id == req.BeanId && b.UserId == me.Id, ct);
            if (!beanExists) return Results.ValidationProblem(new Dictionary<string, string[]> { ["beanId"] = ["Unknown bean."] });

            var p = req.Params;
            var brew = new Brew
            {
                Id = Guid.NewGuid(),
                UserId = me.Id,
                BeanId = req.BeanId,
                Grind = p.Grind, DoseG = p.DoseG, YieldG = p.YieldG, TempC = p.TempC, Blooms = p.Blooms,
                DurationMs = req.DurationMs,
                PourMarkersMs = (req.PourMarkersMs ?? []).Where(m => m >= 0).OrderBy(m => m).ToList(),
                BrewedAt = clock.GetUtcNow(),
            };

            // Per-user sequence: MAX+1 guarded by the unique (user_id, number) index. A concurrent
            // insert from the same user loses the race and retries with a fresh number.
            for (var attempt = 0; ; attempt++)
            {
                brew.Number = (await db.Brews.Where(b => b.UserId == me.Id).Select(b => (int?)b.Number).MaxAsync(ct) ?? 0) + 1;
                db.Brews.Add(brew);
                try
                {
                    await db.SaveChangesAsync(ct);
                    break;
                }
                catch (DbUpdateException) when (attempt < 3)
                {
                    db.Entry(brew).State = EntityState.Detached;
                }
            }
            var unlocked = await achievements.EvaluateAsync(me.Id, brew.Id, ct);
            return Results.Created($"/api/v1/brews/{brew.Id}", BrewResponse.From(brew, Unlocked(unlocked)));
        });

        g.MapDelete("/{id:guid}", async (Guid id, CurrentUser me, BrewbookDbContext db, CancellationToken ct) =>
        {
            // Undo from the toast. Only the user's latest brew can be removed, so the sequence never gets holes.
            var brew = await db.Brews.SingleOrDefaultAsync(b => b.Id == id && b.UserId == me.Id, ct);
            if (brew is null) return Results.NotFound();
            var latest = await db.Brews.Where(b => b.UserId == me.Id).MaxAsync(b => b.Number, ct);
            if (brew.Number != latest) return Results.Problem("Only the most recent brew can be undone.", statusCode: 409);
            db.Brews.Remove(brew);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        g.MapPatch("/{id:guid}/rating", async (Guid id, RateBrewRequest req, CurrentUser me, BrewbookDbContext db, AchievementService achievements, CancellationToken ct) =>
        {
            if (req.Rating is { } r && (r < 0 || r > 5))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["rating"] = ["Rating must be 0–5."] });
            var unknown = (req.Defects ?? []).Where(d => !KnownDefects.Contains(d)).ToList();
            if (unknown.Count > 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["defects"] = [$"Unknown defects: {string.Join(", ", unknown)}."] });

            var brew = await db.Brews.Include(b => b.FlavourTags).SingleOrDefaultAsync(b => b.Id == id && b.UserId == me.Id, ct);
            if (brew is null) return Results.NotFound();
            if (req.Rating is { } rating) brew.Rating = rating;
            if (req.Defects is { } defects) brew.Defects = defects.Distinct().ToList();
            await db.SaveChangesAsync(ct);
            var unlocked = await achievements.EvaluateAsync(me.Id, brew.Id, ct);
            return Results.Ok(BrewResponse.From(brew, Unlocked(unlocked)));
        });

        g.MapPut("/{id:guid}/tags", async (Guid id, TagBrewRequest req, CurrentUser me, BrewbookDbContext db, AchievementService achievements, CancellationToken ct) =>
        {
            var bad = req.Tags.Where(t => string.IsNullOrWhiteSpace(t.Flavour) || (t.Polarity != 1 && t.Polarity != -1)).ToList();
            if (bad.Count > 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["tags"] = ["Each tag needs a flavour and a polarity of +1 or −1."] });

            var brew = await db.Brews.Include(b => b.FlavourTags).SingleOrDefaultAsync(b => b.Id == id && b.UserId == me.Id, ct);
            if (brew is null) return Results.NotFound();

            // Full replace: the wheel owns the whole tag set for a brew.
            db.FlavourTags.RemoveRange(brew.FlavourTags);
            brew.FlavourTags = req.Tags
                .GroupBy(t => t.Flavour.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(gr => new FlavourTag { BrewId = brew.Id, Flavour = gr.Key, Polarity = gr.Last().Polarity })
                .ToList();
            await db.SaveChangesAsync(ct);
            var unlocked = await achievements.EvaluateAsync(me.Id, brew.Id, ct);
            return Results.Ok(BrewResponse.From(brew, Unlocked(unlocked)));
        });

        return api;
    }

    private static List<UnlockedDto> Unlocked(IReadOnlyList<string> keys)
        => keys.Select(k => new UnlockedDto(k, AchievementCatalogue.Find(k)?.Title ?? k)).ToList();

    private static Dictionary<string, string[]> Validate(CreateBrewRequest req)
    {
        var e = new Dictionary<string, string[]>();
        var p = req.Params;
        if (p is null) { e["params"] = ["Params are required."]; return e; }
        if (p.Grind < 0 || p.Grind > 100) e["params.grind"] = ["Grind must be 0–100."];
        if (p.DoseG <= 0 || p.DoseG > 500) e["params.doseG"] = ["Dose must be 0–500 g."];
        if (p.YieldG <= 0 || p.YieldG > 5000) e["params.yieldG"] = ["Yield must be 0–5000 g."];
        if (p.TempC < 0 || p.TempC > 100) e["params.tempC"] = ["Water must be 0–100 °C."];
        if (p.Blooms < 0 || p.Blooms > 20) e["params.blooms"] = ["Blooms must be 0–20."];
        if (req.DurationMs < 0 || req.DurationMs > 3_600_000) e["durationMs"] = ["Duration must be under an hour."];
        return e;
    }
}
