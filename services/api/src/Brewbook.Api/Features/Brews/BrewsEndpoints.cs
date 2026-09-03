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

            var p = req.Params.ToDomain().Normalised();
            var brew = new Brew
            {
                Id = Guid.NewGuid(),
                UserId = me.Id,
                BeanId = req.BeanId,
                Method = p.Method, Grind = p.Grind, DoseG = p.DoseG, YieldG = p.YieldG, TempC = p.TempC,
                Blooms = p.Blooms, PreInfusionS = p.PreInfusionS, TargetMs = p.TargetMs,
                // Untimed until a time arrives: the scale's timer, typed in on the rate card.
                DurationMs = req.DurationMs ?? 0,
                PourMarkersMs = (req.PourMarkersMs ?? []).Where(m => m >= 0).OrderBy(m => m).ToList(),
                // Rating publishes; the default decides whether that reaches friends, per brew after this.
                IsPrivate = !me.Required.ShareRatedByDefault,
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
            // Undo from the toast, or a torn-out page from the log. The number is not reused: a hole in
            // the sequence is what a deleted ticket looks like, and N° 042 keeps meaning one brew.
            var brew = await db.Brews.SingleOrDefaultAsync(b => b.Id == id && b.UserId == me.Id, ct);
            if (brew is null) return Results.NotFound();
            db.Brews.Remove(brew);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // The brew after the fact: params, time, when, rating, privacy. Null leaves a field alone.
        g.MapPatch("/{id:guid}", async (Guid id, UpdateBrewRequest req, CurrentUser me, BrewbookDbContext db, TimeProvider clock, AchievementService achievements, CancellationToken ct) =>
        {
            var errors = ValidateUpdate(req, clock.GetUtcNow());
            if (errors.Count > 0) return Results.ValidationProblem(errors);

            var brew = await db.Brews.Include(b => b.FlavourTags).SingleOrDefaultAsync(b => b.Id == id && b.UserId == me.Id, ct);
            if (brew is null) return Results.NotFound();
            if (req.Params is { } dto)
            {
                var p = dto.ToDomain().Normalised();
                brew.Method = p.Method; brew.Grind = p.Grind; brew.DoseG = p.DoseG; brew.YieldG = p.YieldG; brew.TempC = p.TempC;
                brew.Blooms = p.Blooms; brew.PreInfusionS = p.PreInfusionS; brew.TargetMs = p.TargetMs;
            }
            if (req.DurationMs is { } duration) brew.DurationMs = duration;
            if (req.BrewedAt is { } at) brew.BrewedAt = at;
            if (req.Rating is { } rating) brew.Rating = rating;
            if (req.Defects is { } defects) brew.Defects = defects.Distinct().ToList();
            if (req.IsPrivate is { } isPrivate) brew.IsPrivate = isPrivate;
            await db.SaveChangesAsync(ct);
            var unlocked = await achievements.EvaluateAsync(me.Id, brew.Id, ct);
            return Results.Ok(BrewResponse.From(brew, Unlocked(unlocked)));
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

        // Any brew can be made private, per brew (§5). The workshop stays visible by default.
        g.MapPatch("/{id:guid}/privacy", async (Guid id, SetBrewPrivacyRequest req, CurrentUser me, BrewbookDbContext db, CancellationToken ct) =>
        {
            var brew = await db.Brews.Include(b => b.FlavourTags).SingleOrDefaultAsync(b => b.Id == id && b.UserId == me.Id, ct);
            if (brew is null) return Results.NotFound();
            brew.IsPrivate = req.IsPrivate;
            await db.SaveChangesAsync(ct);
            return Results.Ok(BrewResponse.From(brew));
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

    private const string DurationMessage = "Duration must be under an hour.";
    private static bool ValidDuration(int ms) => ms is >= 0 and <= 3_600_000;

    private static Dictionary<string, string[]> Validate(CreateBrewRequest req)
    {
        var e = new Dictionary<string, string[]>();
        if (req.Params is null) { e["params"] = ["Params are required."]; return e; }
        ValidateParams(req.Params, e);
        if (req.DurationMs is { } d && !ValidDuration(d)) e["durationMs"] = [DurationMessage];
        return e;
    }

    private static Dictionary<string, string[]> ValidateUpdate(UpdateBrewRequest req, DateTimeOffset now)
    {
        var e = new Dictionary<string, string[]>();
        if (req.Params is { } p) ValidateParams(p, e);
        if (req.DurationMs is { } d && !ValidDuration(d)) e["durationMs"] = [DurationMessage];
        // A little clock skew is fine; a brew from next week is not.
        if (req.BrewedAt is { } at && (at > now.AddMinutes(5) || at.Year < 2000)) e["brewedAt"] = ["Brewed-at must be in the past."];
        if (req.Rating is { } r && (r < 0 || r > 5)) e["rating"] = ["Rating must be 0–5."];
        var unknown = (req.Defects ?? []).Where(x => !KnownDefects.Contains(x)).ToList();
        if (unknown.Count > 0) e["defects"] = [$"Unknown defects: {string.Join(", ", unknown)}."];
        return e;
    }

    private static void ValidateParams(BrewParamsDto p, Dictionary<string, string[]> e)
    {
        if (!Enum.IsDefined(p.Method)) e["params.method"] = ["Unknown brew method."];
        if (p.Grind < 0 || p.Grind > 100) e["params.grind"] = ["Grind must be 0–100."];
        if (p.DoseG <= 0 || p.DoseG > 500) e["params.doseG"] = ["Dose must be 0–500 g."];
        if (p.YieldG <= 0 || p.YieldG > 5000) e["params.yieldG"] = ["Yield must be 0–5000 g."];
        if (p.TempC < 0 || p.TempC > 100) e["params.tempC"] = ["Water must be 0–100 °C."];
        if (p.Blooms < 0 || p.Blooms > 20) e["params.blooms"] = ["Blooms must be 0–20."];
        if (p.PreInfusionS is < 0 or > 60) e["params.preInfusionS"] = ["Pre-infusion must be 0–60 s."];
        if (!ValidDuration(p.TargetMs)) e["params.targetMs"] = ["Target time must be under an hour."];
    }
}
