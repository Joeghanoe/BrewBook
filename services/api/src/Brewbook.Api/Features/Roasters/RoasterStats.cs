using Brewbook.Api.Contracts;
using Brewbook.Api.Domain;

namespace Brewbook.Api.Features.Roasters;

/// <summary>Pure aggregation of one user's bags, brews and tags per roaster. No container, no database.</summary>
public static class RoasterStats
{
    public const int TopFlavourCount = 5;

    public sealed record Input(Roaster Roaster, IReadOnlyList<Bean> Bags, IReadOnlyList<Brew> Brews);

    public static RoasterResponse Build(Input input, IReadOnlyList<string> wantedFlavours)
    {
        var r = input.Roaster;
        var rated = input.Brews.Where(b => b.Rating > 0).ToList();
        var avg = rated.Count == 0 ? (double?)null : Math.Round(rated.Average(b => b.Rating), 1);

        var tags = input.Brews.SelectMany(b => b.FlavourTags).ToList();
        var liked = Ranked(tags.Where(t => t.Polarity > 0));
        var disliked = Ranked(tags.Where(t => t.Polarity < 0));

        int? match = wantedFlavours.Count == 0
            ? null
            : wantedFlavours.Count(w => liked.Contains(w, StringComparer.OrdinalIgnoreCase));

        return new RoasterResponse(
            r.Id, r.Name, r.FormattedAddress, r.Lat, r.Lng, r.Located, r.Website,
            input.Bags.Count, input.Brews.Count, avg,
            liked.Take(TopFlavourCount).ToList(), disliked.Take(TopFlavourCount).ToList(), match);
    }

    /// <summary>Flavours by how often they were tagged, ties broken alphabetically so the order is stable.</summary>
    private static List<string> Ranked(IEnumerable<FlavourTag> tags) => tags
        .GroupBy(t => t.Flavour, StringComparer.OrdinalIgnoreCase)
        .OrderByDescending(g => g.Count()).ThenBy(g => g.Key, StringComparer.OrdinalIgnoreCase)
        .Select(g => g.First().Flavour)
        .ToList();

    /// <summary>"Peach, jasmine ,,Rose" → ["Peach", "jasmine", "Rose"].</summary>
    public static IReadOnlyList<string> ParseFlavours(string? csv) =>
        (csv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
}
