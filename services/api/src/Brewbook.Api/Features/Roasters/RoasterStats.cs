using Brewbook.Api.Contracts;
using Brewbook.Api.Domain;

namespace Brewbook.Api.Features.Roasters;

/// <summary>
/// Pure aggregation of bags, brews and tags per roaster, per person. No container, no database.
/// Each person keeps their own rating: the app never averages people into a score (§4).
/// </summary>
public static class RoasterStats
{
    public const int TopFlavourCount = 5;

    /// <summary>One person's bags and brews from a roaster.</summary>
    public sealed record Person(Guid UserId, string Name, bool IsMe, IReadOnlyList<Bean> Bags, IReadOnlyList<Brew> Brews);

    public sealed record Input(Roaster Roaster, IReadOnlyList<Person> People, bool Wished = false);

    public static Input Mine(Roaster roaster, IReadOnlyList<Bean> bags, IReadOnlyList<Brew> brews, Guid userId, string name)
        => new(roaster, [new Person(userId, name, true, bags, brews)]);

    public static RoasterResponse Build(Input input, IReadOnlyList<string> wantedFlavours)
    {
        var r = input.Roaster;
        var voices = input.People
            .Select(p => Voice(p, wantedFlavours))
            .OrderByDescending(v => v.IsMe)
            .ThenByDescending(v => v.AvgRating ?? -1)
            .ThenBy(v => v.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var mine = voices.FirstOrDefault(v => v.IsMe);
        // The filter keeps a roaster any voice matches: "who near me roasts the thing I keep tagging?"
        // is a question a friend can answer as well as the user's own log (§4).
        int? match = wantedFlavours.Count == 0 ? null : voices.Max(v => v.MatchCount ?? 0);

        return new RoasterResponse(
            r.Id, r.Name, r.FormattedAddress, r.Lat, r.Lng, r.Located, r.Website,
            mine?.Bags ?? 0, mine?.Brews ?? 0, mine?.AvgRating,
            mine?.TopFlavours ?? [], mine?.DislikedFlavours ?? [], match,
            voices, mine is not null, input.Wished);
    }

    private static RoasterVoice Voice(Person p, IReadOnlyList<string> wantedFlavours)
    {
        var rated = p.Brews.Where(b => b.Rating > 0).ToList();
        var avg = rated.Count == 0 ? (double?)null : Math.Round(rated.Average(b => b.Rating), 1);

        var tags = p.Brews.SelectMany(b => b.FlavourTags).ToList();
        var liked = Ranked(tags.Where(t => t.Polarity > 0));
        var disliked = Ranked(tags.Where(t => t.Polarity < 0));

        int? match = wantedFlavours.Count == 0
            ? null
            : wantedFlavours.Count(w => liked.Contains(w, StringComparer.OrdinalIgnoreCase));

        return new RoasterVoice(
            p.UserId, p.Name, PersonName.Initials(p.Name), p.IsMe, p.Bags.Count, p.Brews.Count, avg,
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
