using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Brewbook.Api.Features.Labels;
using Microsoft.EntityFrameworkCore;

namespace Brewbook.Api.Features.Achievements;

public static class AchievementsEndpoints
{
    public static RouteGroupBuilder MapAchievements(this RouteGroupBuilder api)
    {
        api.MapGet("/achievements", async (CurrentUser me, BrewbookDbContext db, AchievementService achievements, CancellationToken ct) =>
        {
            // Reading re-evaluates, so a stamp added to the catalogue later lands on the next look at the passport.
            await achievements.EvaluateAsync(me.Id, null, ct);
            var facts = await achievements.LoadFactsAsync(me.Id, ct);
            var held = await db.Achievements.Where(a => a.UserId == me.Id).ToDictionaryAsync(a => a.Key, a => a.UnlockedAt, ct);

            var list = AchievementCatalogue.All.Select(r =>
            {
                var p = r.Evaluate(facts);
                var unlockedAt = held.TryGetValue(r.Key, out var at) ? at : (DateTimeOffset?)null;
                return new AchievementDto(r.Key, r.Title, r.Subtitle, unlockedAt is not null, unlockedAt, new ProgressDto(p.Have, p.Of));
            }).ToList();

            var leaves = FlavourWheel.Categories
                .SelectMany(c => c.Groups.SelectMany(g => g.Leaves.Select(l =>
                    new LeafCoverageDto(l, c.Name, g.Name, facts.HasTasted(l), facts.Tasted.TryGetValue(l, out var last) ? last : null))))
                .ToList();
            var categories = FlavourWheel.Categories
                .Select(c => new CategoryCoverageDto(c.Name, facts.TastedIn(c.Leaves), c.Leaves.Count()))
                .ToList();

            return Results.Ok(new AchievementsResponse(list, new CoverageDto(leaves, categories)));
        });
        return api;
    }
}
