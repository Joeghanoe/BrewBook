using Brewbook.Api.Features.Labels;

namespace Brewbook.Api.Features.Achievements;

// What a rule sees. Tags carry the brew's date because a tag is a tasting of that brew.
public sealed record BrewFact(Guid Id, DateTimeOffset BrewedAt);
public sealed record TagFact(Guid BrewId, string Flavour, int Polarity, DateTimeOffset TastedAt);
public sealed record BeanFact(string? Roaster);

public sealed record Progress(int Have, int Of)
{
    public bool Unlocked => Have >= Of;
}

/// <summary>Everything the rules need, computed once per evaluation.</summary>
public sealed class AchievementFacts
{
    public IReadOnlyList<BrewFact> Brews { get; }
    public IReadOnlyList<TagFact> Tags { get; }
    public IReadOnlyList<BeanFact> Beans { get; }

    /// <summary>Wheel leaves tasted (either polarity), canonical text → last tasting.</summary>
    public IReadOnlyDictionary<string, DateTimeOffset> Tasted { get; }

    public AchievementFacts(IReadOnlyList<BrewFact> brews, IReadOnlyList<TagFact> tags, IReadOnlyList<BeanFact> beans)
    {
        Brews = brews;
        Tags = tags;
        Beans = beans;
        var tasted = new Dictionary<string, DateTimeOffset>(StringComparer.Ordinal);
        foreach (var t in tags)
        {
            if (FlavourWheel.Canonical(t.Flavour) is not { } leaf) continue;
            if (!tasted.TryGetValue(leaf, out var last) || t.TastedAt > last) tasted[leaf] = t.TastedAt;
        }
        Tasted = tasted;
    }

    public bool HasTasted(string leaf) => Tasted.ContainsKey(leaf);
    public int TastedIn(IEnumerable<string> leaves) => leaves.Count(HasTasted);
}

public sealed record AchievementRule(string Key, string Title, string Subtitle, Func<AchievementFacts, Progress> Evaluate);

/// <summary>The passport's pages. Pure over <see cref="AchievementFacts"/>; order is the display order.</summary>
public static class AchievementCatalogue
{
    private static readonly TimeSpan Week = TimeSpan.FromDays(7);

    private static readonly Dictionary<string, string> GroupTitles = new()
    {
        ["BERRY"] = "Berry picker",
        ["DRIED"] = "Dried goods",
        ["CITRUS"] = "Citrus press",
        ["STONE"] = "Orchard keeper",
        ["FLOWERS"] = "Florist",
        ["TEA"] = "Tea service",
        ["SUGARS"] = "Sugar shack",
        ["CONFECTION"] = "Confectioner",
        ["NUTS"] = "Nutcracker",
        ["PASTE"] = "Pâtissier",
        ["CHOCOLATE"] = "Chocolatier",
        ["WARM"] = "Spice cabinet",
        ["SHARP"] = "Sharp tongue",
        ["TOASTED"] = "Grain store",
        ["SMOKY"] = "Smokehouse",
        ["VEGETAL"] = "Greenhouse",
        ["UNDER-RIPE"] = "Early harvest",
        ["FERMENTED"] = "Cellar master",
        ["TEXTURE"] = "Mouthfeel",
    };

    public static readonly IReadOnlyList<AchievementRule> All = Build();

    private static readonly Dictionary<string, AchievementRule> ByKey = All.ToDictionary(r => r.Key);

    public static AchievementRule? Find(string key) => ByKey.GetValueOrDefault(key);

    public static string CategoryKey(string category) => "ALL_OF_" + Slug(category);
    public static string GroupKey(string group) => "GROUP_" + Slug(group);
    private static string Slug(string name) => name.ToUpperInvariant().Replace('-', '_').Replace(' ', '_');

    private static List<AchievementRule> Build()
    {
        var leaves = FlavourWheel.Leaves.Count;
        var rules = new List<AchievementRule>
        {
            new("FIRST_TASTE", "First taste", "one flavour tagged, liked or not",
                f => new(Math.Min(1, f.Tags.Count), 1)),
            new("CARTOGRAPHER", "Cartographer", "a leaf in every one of the nine wedges",
                f => new(FlavourWheel.Categories.Count(c => f.TastedIn(c.Leaves) > 0), FlavourWheel.Categories.Count)),
            new("HALF_WHEEL", "Half wheel", "half the leaves on the wheel",
                f => new(f.Tasted.Count, (leaves + 1) / 2)),
            new("FULL_WHEEL", "Full wheel", "every leaf on the wheel",
                f => new(f.Tasted.Count, leaves)),
        };

        foreach (var c in FlavourWheel.Categories)
        {
            var cat = c;
            rules.Add(new(CategoryKey(c.Name), "All of " + Title(c.Name), $"every leaf in the {c.Name.ToLowerInvariant()} wedge",
                f => new(f.TastedIn(cat.Leaves), cat.Leaves.Count())));
        }

        foreach (var c in FlavourWheel.Categories)
            foreach (var g in c.Groups)
            {
                var grp = g;
                rules.Add(new(GroupKey(g.Name), GroupTitles[g.Name], $"every {g.Name.ToLowerInvariant()} leaf under {c.Name.ToLowerInvariant()}",
                    f => new(f.TastedIn(grp.Leaves), grp.Leaves.Count)));
            }

        rules.AddRange(
        [
            new("CONTRARIAN", "Contrarian", "ten flavours marked as dislikes",
                f => new(f.Tags.Count(t => t.Polarity < 0), 10)),
            new("REGULAR", "Regular", "seven brews inside seven days",
                f => new(BrewsInAnyWeek(f.Brews), 7)),
            new("CENTURION", "Centurion", "one hundred brews logged",
                f => new(f.Brews.Count, 100)),
            new("FIVE_BAGS", "Five bags", "five bags on the shelf, open or archived",
                f => new(f.Beans.Count, 5)),
            new("THREE_ROASTERS", "Three roasters", "bags from three different roasters",
                f => new(f.Beans.Select(b => b.Roaster?.Trim()).Where(r => !string.IsNullOrEmpty(r)).Distinct(StringComparer.OrdinalIgnoreCase).Count(), 3)),
        ]);
        return rules;
    }

    /// <summary>Most brews falling in any window of seven days.</summary>
    private static int BrewsInAnyWeek(IReadOnlyList<BrewFact> brews)
    {
        var at = brews.Select(b => b.BrewedAt).OrderBy(d => d).ToList();
        int best = 0, start = 0;
        for (var end = 0; end < at.Count; end++)
        {
            while (at[end] - at[start] >= Week) start++;
            best = Math.Max(best, end - start + 1);
        }
        return best;
    }

    private static string Title(string upper) => upper[..1] + upper[1..].ToLowerInvariant();
}
