using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Brewbook.Api.Features.Labels;
using Microsoft.EntityFrameworkCore;

namespace Brewbook.Api.Features.Beans;

public static class BeansEndpoints
{
    public static RouteGroupBuilder MapBeans(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/beans");

        g.MapGet("/", async (CurrentUser me, BrewbookDbContext db, CancellationToken ct) =>
        {
            var beans = (await db.Beans.Where(b => b.UserId == me.Id).ToListAsync(ct)).OrderByDescending(b => b.CreatedAt).ToList();
            return Results.Ok(await Project(db, beans, ct));
        });

        g.MapGet("/{id:guid}", async (Guid id, CurrentUser me, BrewbookDbContext db, CancellationToken ct) =>
        {
            var bean = await db.Beans.SingleOrDefaultAsync(b => b.Id == id && b.UserId == me.Id, ct);
            return bean is null ? Results.NotFound() : Results.Ok((await Project(db, [bean], ct))[0]);
        });

        g.MapPost("/", async (CreateBeanRequest req, CurrentUser me, BrewbookDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var name = req.Name?.Trim();
            if (string.IsNullOrEmpty(name))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["Name is required."] });

            var bean = new Bean
            {
                Id = Guid.NewGuid(),
                UserId = me.Id,
                Name = name,
                Roaster = Clean(req.Roaster),
                Origin = Clean(req.Origin),
                Process = Clean(req.Process),
                RoastDate = req.RoastDate,
                Producer = Clean(req.Producer),
                Varietal = Clean(req.Varietal),
                Altitude = Clean(req.Altitude),
                RoastLevel = Clean(req.RoastLevel),
                DeclaredNotes = (req.DeclaredNotes ?? []).Select(n => n.Trim()).Where(n => n.Length > 0).Distinct().ToList(),
                LabelScanId = Clean(req.LabelScanId),
                LabelScannedAt = req.LabelScanId is null ? null : clock.GetUtcNow(),
                CreatedAt = clock.GetUtcNow(),
            };
            db.Beans.Add(bean);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/v1/beans/{bean.Id}", BeanResponse.From(bean, 0, null));
        });

        g.MapPatch("/{id:guid}", async (Guid id, UpdateBeanRequest req, CurrentUser me, BrewbookDbContext db, CancellationToken ct) =>
        {
            var bean = await db.Beans.SingleOrDefaultAsync(b => b.Id == id && b.UserId == me.Id, ct);
            if (bean is null) return Results.NotFound();
            if (req.Archived is { } archived) bean.Archived = archived;
            await db.SaveChangesAsync(ct);
            return Results.Ok((await Project(db, [bean], ct))[0]);
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

    private static async Task<List<BeanResponse>> Project(BrewbookDbContext db, List<Bean> beans, CancellationToken ct)
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
        return beans.Select(b => BeanResponse.From(b, counts.GetValueOrDefault(b.Id), lasts.GetValueOrDefault(b.Id))).ToList();
    }
}
