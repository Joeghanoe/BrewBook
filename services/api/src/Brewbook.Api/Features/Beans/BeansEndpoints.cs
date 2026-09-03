using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Brewbook.Api.Features.Achievements;
using Brewbook.Api.Features.Labels;
using Brewbook.Api.Features.Roasters;
using Microsoft.EntityFrameworkCore;

namespace Brewbook.Api.Features.Beans;

public static class BeansEndpoints
{
    public static RouteGroupBuilder MapBeans(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/beans");

        g.MapGet("/", async (CurrentUser me, BrewbookDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var beans = (await db.Beans.Include(b => b.LinkedRoaster).Where(b => b.UserId == me.Id).ToListAsync(ct)).OrderByDescending(b => b.CreatedAt).ToList();
            return Results.Ok(await Project(db, beans, clock, ct));
        });

        g.MapGet("/{id:guid}", async (Guid id, CurrentUser me, BrewbookDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var bean = await db.Beans.Include(b => b.LinkedRoaster).SingleOrDefaultAsync(b => b.Id == id && b.UserId == me.Id, ct);
            return bean is null ? Results.NotFound() : Results.Ok((await Project(db, [bean], clock, ct))[0]);
        });

        g.MapPost("/", async (CreateBeanRequest req, CurrentUser me, BrewbookDbContext db, TimeProvider clock, AchievementService achievements, CancellationToken ct) =>
        {
            var name = req.Name?.Trim();
            if (string.IsNullOrEmpty(name))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["Name is required."] });

            var bean = new Bean
            {
                Id = Guid.NewGuid(),
                UserId = me.Id,
                Name = name,
                Roaster = RoasterName.Display(req.Roaster),
                Origin = Clean(req.Origin),
                Process = Clean(req.Process),
                RoastDate = req.RoastDate,
                Producer = Clean(req.Producer),
                Varietal = Clean(req.Varietal),
                Altitude = Clean(req.Altitude),
                RoastLevel = Clean(req.RoastLevel),
                DeclaredNotes = (req.DeclaredNotes ?? []).Select(n => n.Trim()).Where(n => n.Length > 0).Distinct().ToList(),
                WeightG = req.WeightG is > 0 and <= 100_000 ? req.WeightG : null,
                LabelScanId = Clean(req.LabelScanId),
                LabelScannedAt = req.LabelScanId is null ? null : clock.GetUtcNow(),
                CreatedAt = clock.GetUtcNow(),
            };
            db.Beans.Add(bean);
            await RoasterLinker.LinkAndSaveAsync(db, bean, clock, ct);
            // A bag from a wished-for roaster clears the pin: it has done its job (§4).
            if (bean.RoasterId is { } linked)
            {
                var wish = await db.RoasterWishes.FindAsync([me.Id, linked], ct);
                if (wish is not null) { db.RoasterWishes.Remove(wish); await db.SaveChangesAsync(ct); }
            }
            // Bag stamps show up on the passport; the bean response stays a bean.
            await achievements.EvaluateAsync(me.Id, null, ct);
            // The client decides from the response whether to offer the roaster picker, so the row's state has to be on it.
            if (bean.RoasterId is not null && bean.LinkedRoaster is null) await db.Entry(bean).Reference(b => b.LinkedRoaster).LoadAsync(ct);
            return Results.Created($"/api/v1/beans/{bean.Id}", BeanResponse.From(bean, 0, null, 0m, clock.GetUtcNow()));
        });

        g.MapPatch("/{id:guid}", async (Guid id, UpdateBeanRequest req, CurrentUser me, BrewbookDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var bean = await db.Beans.Include(b => b.LinkedRoaster).SingleOrDefaultAsync(b => b.Id == id && b.UserId == me.Id, ct);
            if (bean is null) return Results.NotFound();

            if (req.Name is not null)
            {
                var name = req.Name.Trim();
                if (name.Length == 0)
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["Name is required."] });
                bean.Name = name;
            }
            if (req.Origin is not null) bean.Origin = Clean(req.Origin);
            if (req.Process is not null) bean.Process = Clean(req.Process);
            if (req.Producer is not null) bean.Producer = Clean(req.Producer);
            if (req.Varietal is not null) bean.Varietal = Clean(req.Varietal);
            if (req.Altitude is not null) bean.Altitude = Clean(req.Altitude);
            if (req.RoastLevel is not null) bean.RoastLevel = Clean(req.RoastLevel);
            if (req.DeclaredNotes is not null)
                bean.DeclaredNotes = req.DeclaredNotes.Select(n => n.Trim()).Where(n => n.Length > 0).Distinct().ToList();
            // A date and a weight are values, so clearing one needs saying rather than a magic number.
            if (req.RoastDate is { } roastDate) bean.RoastDate = roastDate;
            if (req.ClearRoastDate is true) bean.RoastDate = null;
            if (req.WeightG is { } weight) bean.WeightG = weight is > 0 and <= 100_000 ? weight : bean.WeightG;
            if (req.ClearWeight is true) bean.WeightG = null;

            if (req.Archived is { } archived) bean.Archived = archived;
            // Asked once, then never again for that bag, whichever way the user answered.
            if (req.ArchivePromptAnswered is true && bean.ArchivePromptedAt is null) bean.ArchivePromptedAt = clock.GetUtcNow();

            // A corrected roaster name has to re-point the bag, or the map keeps the old one.
            if (req.Roaster is not null && RoasterName.Display(req.Roaster) != bean.Roaster)
            {
                bean.Roaster = RoasterName.Display(req.Roaster);
                bean.LinkedRoaster = null;
                await RoasterLinker.LinkAndSaveAsync(db, bean, clock, ct);
                if (bean.RoasterId is not null && bean.LinkedRoaster is null) await db.Entry(bean).Reference(b => b.LinkedRoaster).LoadAsync(ct);
            }
            else
            {
                await db.SaveChangesAsync(ct);
            }
            return Results.Ok((await Project(db, [bean], clock, ct))[0]);
        });

        g.MapPost("/scan", async (HttpRequest http, ILabelExtractor extractor, CancellationToken ct) =>
        {
            if (!http.HasFormContentType) return Results.Problem("Expected multipart/form-data with an 'image' file.", statusCode: 415);
            var form = await http.ReadFormAsync(ct);
            var file = form.Files.GetFile("image");
            if (file is null || file.Length == 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["image"] = ["A label image is required."] });
            if (file.Length > 10 * 1024 * 1024) return Results.Problem("Label image exceeds 10 MB.", statusCode: 413);

            await using var stream = file.OpenReadStream();
            var bytes = new byte[file.Length];
            await stream.ReadExactlyAsync(bytes, ct);
            var result = await extractor.ExtractAsync(bytes, file.ContentType ?? "image/jpeg", ct);
            return Results.Ok(result);
        }).DisableAntiforgery();

        return api;
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static async Task<List<BeanResponse>> Project(BrewbookDbContext db, List<Bean> beans, TimeProvider clock, CancellationToken ct)
    {
        var ids = beans.Select(b => b.Id).ToList();
        var counts = await db.Brews.Where(br => ids.Contains(br.BeanId))
            .GroupBy(br => br.BeanId)
            .Select(gr => new { BeanId = gr.Key, Count = gr.Count() })
            .ToDictionaryAsync(x => x.BeanId, x => x.Count, ct);
        // Latest brew per bean. A personal log stays small enough that reading the brews of the
        // listed beans and picking the newest in memory beats a correlated subquery per bean.
        var lasts = (await db.Brews.Where(br => ids.Contains(br.BeanId)).OrderByDescending(br => br.Number).ToListAsync(ct))
            .DistinctBy(br => br.BeanId)
            .ToDictionary(br => br.BeanId);
        // What the bag has actually given up: the doses brewed from it, which is the countdown's other half.
        var dosed = await db.Brews.Where(br => ids.Contains(br.BeanId))
            .GroupBy(br => br.BeanId)
            .Select(gr => new { BeanId = gr.Key, Dosed = gr.Sum(x => x.DoseG) })
            .ToDictionaryAsync(x => x.BeanId, x => x.Dosed, ct);
        var now = clock.GetUtcNow();
        return beans.Select(b => BeanResponse.From(b, counts.GetValueOrDefault(b.Id), lasts.GetValueOrDefault(b.Id), dosed.GetValueOrDefault(b.Id), now)).ToList();
    }
}
