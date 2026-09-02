using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Brewbook.Api.Integrations.GooglePlaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Brewbook.Api.Features.Roasters;

public static class RoastersEndpoints
{
    /// <summary>Locations fill in lazily on the list call. A personal log has a handful of roasters; this bounds one request's outbound calls.</summary>
    private const int MaxResolvesPerRequest = 8;

    public static RouteGroupBuilder MapRoasters(this RouteGroupBuilder api)
    {
        api.MapGet("/config", (IOptions<GoogleMapsOptions> maps) =>
            Results.Ok(new ConfigResponse(string.IsNullOrWhiteSpace(maps.Value.BrowserKey) ? null : maps.Value.BrowserKey)));

        var g = api.MapGroup("/roasters");

        g.MapGet("/", async (string? flavours, CurrentUser me, BrewbookDbContext db, IRoasterLocator locator, TimeProvider clock, CancellationToken ct) =>
        {
            var wanted = RoasterStats.ParseFlavours(flavours);
            var bags = await db.Beans.Include(b => b.LinkedRoaster).Where(b => b.UserId == me.Id && b.RoasterId != null).ToListAsync(ct);
            if (bags.Count == 0) return Results.Ok(Array.Empty<RoasterResponse>());

            var beanIds = bags.Select(b => b.Id).ToList();
            var brews = await db.Brews.Include(b => b.FlavourTags).Where(b => beanIds.Contains(b.BeanId)).ToListAsync(ct);
            var brewsByBean = brews.ToLookup(b => b.BeanId);

            var groups = bags.GroupBy(b => b.LinkedRoaster!).Select(gr => new RoasterStats.Input(
                gr.Key, gr.ToList(), gr.SelectMany(b => brewsByBean[b.Id]).ToList())).ToList();

            // First need: ask the locator for rows nobody has looked up yet, and remember the answer.
            var resolves = 0;
            foreach (var input in groups.Where(i => i.Roaster.ResolvedAt is null))
            {
                if (!locator.Configured || resolves >= MaxResolvesPerRequest) break;
                resolves++;
                await RoasterLinker.ResolveAsync(input.Roaster, input.Roaster.Name, OriginHint(input.Bags), locator, clock, ct);
            }
            if (resolves > 0) await db.SaveChangesAsync(ct);

            var rows = groups.Select(i => RoasterStats.Build(i, wanted));
            if (wanted.Count > 0) rows = rows.Where(r => r.MatchCount > 0);
            var ordered = rows
                .OrderByDescending(r => r.MatchCount ?? 0)
                .ThenByDescending(r => r.AvgRating ?? -1)
                .ThenByDescending(r => r.Brews)
                .ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
            return Results.Ok(ordered);
        });

        g.MapPost("/{id:guid}/relocate", async (Guid id, RelocateRoasterRequest? req, CurrentUser me, BrewbookDbContext db, IRoasterLocator locator, TimeProvider clock, CancellationToken ct) =>
        {
            if (!locator.Configured) return Results.Problem("Roaster lookup is not configured on this deployment.", statusCode: 503);

            // Shared row, but only someone who has logged this roaster may move it; to anyone else it does not exist.
            var bags = await db.Beans.Include(b => b.LinkedRoaster).Where(b => b.UserId == me.Id && b.RoasterId == id).ToListAsync(ct);
            var roaster = bags.FirstOrDefault()?.LinkedRoaster;
            if (roaster is null) return Results.NotFound();

            var query = string.IsNullOrWhiteSpace(req?.Query) ? roaster.Name : req.Query.Trim();
            if (query.Length > 200) query = query[..200];
            // A user-typed query is the whole intent; only the name-based retry gets the origin hint.
            var hint = string.IsNullOrWhiteSpace(req?.Query) ? OriginHint(bags) : null;

            var changed = await RoasterLinker.ResolveAsync(roaster, query, hint, locator, clock, ct);
            if (!changed) return Results.Problem("Roaster lookup is unavailable right now.", statusCode: 503);
            await db.SaveChangesAsync(ct);

            var beanIds = bags.Select(b => b.Id).ToList();
            var brews = await db.Brews.Include(b => b.FlavourTags).Where(b => beanIds.Contains(b.BeanId)).ToListAsync(ct);
            return Results.Ok(RoasterStats.Build(new RoasterStats.Input(roaster, bags, brews), []));
        });

        return api;
    }

    /// <summary>The country from "Huila, Colombia": the most common last segment across the roaster's bags, when there is one.</summary>
    public static string? OriginHint(IEnumerable<Bean> bags) => bags
        .Select(b => b.Origin?.Split(',').Last().Trim())
        .Where(c => !string.IsNullOrEmpty(c))
        .GroupBy(c => c!, StringComparer.OrdinalIgnoreCase)
        .OrderByDescending(gr => gr.Count())
        .Select(gr => gr.Key)
        .FirstOrDefault();
}
