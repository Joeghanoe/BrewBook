using Brewbook.Api.Contracts;
using Brewbook.Api.Domain;
using Brewbook.Api.Features.Labels;

namespace Brewbook.Api.Features.Profile;

/// <summary>
/// Folds one user's beans, brews and tags into a taste profile. Pure: the endpoint reads the
/// three tables, this aggregates in memory. A personal log is small enough that this beats a
/// dozen grouped queries and keeps the rules testable without a database.
/// </summary>
public static class ProfileBuilder
{
    private const int LikedRating = 4;
    private const int TopLikedCount = 5;
    private const int TopDislikedCount = 3;
    private const int TopBeansCount = 5;
    private const int RoasterFlavoursCount = 3;

    public static ProfileResponse Build(User user, IReadOnlyList<Bean> beans, IReadOnlyList<Brew> brews, IReadOnlyList<FlavourTag> tags)
    {
        var brewById = brews.ToDictionary(b => b.Id);
        // Tags of a brew that is not in the list belong to a different user's brew; never count them.
        var tagged = tags
            .Where(t => brewById.ContainsKey(t.BrewId))
            .Select(t => (Tag: t, Brew: brewById[t.BrewId]))
            .ToList();

        var leaves = Leaves(tagged);
        var flavours = new ProfileFlavours(
            leaves,
            FlavourLexicon.Categories.Select(c => new ProfileCategory(c,
                leaves.Where(l => l.Category == c).Sum(l => l.Likes),
                leaves.Where(l => l.Category == c).Sum(l => l.Dislikes))).ToList(),
            leaves.Where(l => l.Likes > 0).OrderByDescending(l => l.Likes).ThenByDescending(l => l.LastTaggedAt).Take(TopLikedCount).ToList(),
            leaves.Where(l => l.Dislikes > 0).OrderByDescending(l => l.Dislikes).ThenByDescending(l => l.LastTaggedAt).Take(TopDislikedCount).ToList());

        var profileBeans = beans.Select(b => BeanRow(b, brews.Where(br => br.BeanId == b.Id).ToList()))
            .OrderByDescending(b => b.Brews).ThenBy(b => b.Name, StringComparer.OrdinalIgnoreCase).ToList();
        var topBeans = profileBeans.Where(b => b.AvgRating is not null)
            .OrderByDescending(b => b.AvgRating).ThenByDescending(b => b.Brews).Take(TopBeansCount).ToList();

        var counts = new ProfileCounts(
            brews.Count,
            beans.Count,
            leaves.Count,
            brews.Select(b => b.BrewedAt.UtcDateTime.Date).Distinct().Count());

        return new ProfileResponse(user.Email, user.DisplayName, counts, flavours, Preferences(brews), profileBeans, topBeans, Roasters(beans, brews, tagged));
    }

    private static List<ProfileFlavour> Leaves(List<(FlavourTag Tag, Brew Brew)> tagged) =>
        tagged
            .GroupBy(t => t.Tag.Flavour.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(gr =>
            {
                var latest = gr.MaxBy(t => t.Brew.BrewedAt);
                var name = latest.Tag.Flavour.Trim();
                return new ProfileFlavour(
                    name,
                    FlavourLexicon.Categorise(name) ?? "OTHER",
                    gr.Count(t => t.Tag.Polarity > 0),
                    gr.Count(t => t.Tag.Polarity < 0),
                    latest.Brew.BrewedAt);
            })
            .OrderByDescending(l => l.Likes).ThenByDescending(l => l.Dislikes).ThenBy(l => l.Flavour, StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static ProfilePreferences Preferences(IReadOnlyList<Brew> brews)
    {
        // Medians only make sense within one method: a grind for espresso says nothing about filter.
        // The profile speaks for the method the user brews most.
        var method = brews.GroupBy(b => b.Method).OrderByDescending(g => g.Count()).ThenBy(g => g.Key).Select(g => (BrewMethod?)g.Key).FirstOrDefault();
        brews = brews.Where(b => b.Method == method).ToList();
        var timed = brews.Where(b => b.DurationMs > 0).ToList();
        var rated = brews.Where(b => b.Rating > 0).ToList();
        var liked = rated.Where(b => b.Rating >= LikedRating).ToList();
        var defects = brews.SelectMany(b => b.Defects)
            .GroupBy(d => d, StringComparer.OrdinalIgnoreCase)
            .Select(gr => new ProfileDefect(gr.Key, gr.Count()))
            .OrderByDescending(d => d.Count).ThenBy(d => d.Defect, StringComparer.OrdinalIgnoreCase)
            .ToList();
        return new ProfilePreferences(
            liked.Count == 0 ? null : Medians(liked),
            brews.Count == 0 ? null : Medians(brews),
            rated.Count,
            liked.Count,
            timed.Count == 0 ? null : MedianInt(timed.Select(b => b.DurationMs)),
            defects);
    }

    private static BrewParamsDto Medians(IReadOnlyList<Brew> brews) => new(
        Median(brews.Select(b => b.Grind)),
        Median(brews.Select(b => b.DoseG)),
        Median(brews.Select(b => b.YieldG)),
        Median(brews.Select(b => b.TempC)),
        MedianInt(brews.Select(b => b.Blooms)),
        brews[0].Method,
        brews[0].Method == BrewMethod.Espresso ? MedianInt(brews.Select(b => b.PreInfusionS ?? 0)) : null,
        MedianInt(brews.Select(b => b.TargetMs)));

    private static ProfileBean BeanRow(Bean bean, List<Brew> brews)
    {
        // Medians only make sense within one method: a grind for espresso says nothing about filter.
        // The profile speaks for the method the user brews most.
        var method = brews.GroupBy(b => b.Method).OrderByDescending(g => g.Count()).ThenBy(g => g.Key).Select(g => (BrewMethod?)g.Key).FirstOrDefault();
        brews = brews.Where(b => b.Method == method).ToList();
        var timed = brews.Where(b => b.DurationMs > 0).ToList();
        var rated = brews.Where(b => b.Rating > 0).ToList();
        var best = rated.OrderByDescending(b => b.Rating).ThenByDescending(b => b.Number).FirstOrDefault();
        return new ProfileBean(bean.Id, bean.Name, bean.Roaster, bean.Archived, brews.Count, Average(rated), best?.Id);
    }

    private static List<ProfileRoaster> Roasters(IReadOnlyList<Bean> beans, IReadOnlyList<Brew> brews, List<(FlavourTag Tag, Brew Brew)> tagged)
    {
        var likedByBrew = tagged.Where(t => t.Tag.Polarity > 0).ToLookup(t => t.Brew.Id, t => t.Tag.Flavour.Trim());
        return beans
            .Where(b => !string.IsNullOrWhiteSpace(b.Roaster))
            .GroupBy(b => b.Roaster!.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(gr =>
            {
                var bagIds = gr.Select(b => b.Id).ToHashSet();
                var roasterBrews = brews.Where(br => bagIds.Contains(br.BeanId)).ToList();
                var topFlavours = roasterBrews.SelectMany(br => likedByBrew[br.Id])
                    .GroupBy(f => f, StringComparer.OrdinalIgnoreCase)
                    .OrderByDescending(f => f.Count()).ThenBy(f => f.Key, StringComparer.OrdinalIgnoreCase)
                    .Take(RoasterFlavoursCount)
                    .Select(f => f.First())
                    .ToList();
                // Spelling as printed on the newest bag, so the profile reads like the label the user last saw.
                var name = gr.MaxBy(b => b.CreatedAt)!.Roaster!.Trim();
                return new ProfileRoaster(name, gr.Count(), roasterBrews.Count, Average(roasterBrews.Where(b => b.Rating > 0).ToList()), topFlavours);
            })
            .OrderByDescending(r => r.Brews).ThenByDescending(r => r.AvgRating).ThenBy(r => r.Roaster, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static decimal? Average(List<Brew> rated) => rated.Count == 0 ? null : Math.Round((decimal)rated.Average(b => b.Rating), 2);

    private static decimal Median(IEnumerable<decimal> values)
    {
        var sorted = values.Order().ToList();
        var n = sorted.Count;
        return n % 2 == 1 ? sorted[n / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    }

    private static int MedianInt(IEnumerable<int> values) =>
        (int)Math.Round(Median(values.Select(v => (decimal)v)), MidpointRounding.AwayFromZero);
}
