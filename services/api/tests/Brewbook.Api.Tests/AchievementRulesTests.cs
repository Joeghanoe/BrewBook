using Brewbook.Api.Features.Achievements;
using Brewbook.Api.Features.Labels;

namespace Brewbook.Api.Tests;

public class AchievementRulesTests
{
    private static readonly DateTimeOffset T0 = new(2026, 9, 1, 8, 0, 0, TimeSpan.Zero);

    private static Progress Eval(string key, IEnumerable<string>? tags = null, int dislikes = 0, IEnumerable<DateTimeOffset>? brews = null, IEnumerable<string?>? roasters = null)
    {
        var brewList = (brews ?? []).Select(at => new BrewFact(Guid.NewGuid(), at)).ToList();
        var brewId = brewList.Count > 0 ? brewList[0].Id : Guid.NewGuid();
        var tagList = (tags ?? []).Select(f => new TagFact(brewId, f, 1, T0)).ToList();
        tagList.AddRange(Enumerable.Range(0, dislikes).Select(i => new TagFact(brewId, $"nope {i}", -1, T0)));
        var beanList = (roasters ?? []).Select(r => new BeanFact(r)).ToList();
        var rule = AchievementCatalogue.Find(key) ?? throw new Xunit.Sdk.XunitException($"No rule {key}");
        return rule.Evaluate(new AchievementFacts(brewList, tagList, beanList));
    }

    [Fact]
    public void Catalogue_keys_are_unique_and_cover_every_wedge_and_group()
    {
        Assert.Equal(AchievementCatalogue.All.Count, AchievementCatalogue.All.Select(r => r.Key).Distinct().Count());
        foreach (var c in FlavourWheel.Categories)
        {
            Assert.NotNull(AchievementCatalogue.Find(AchievementCatalogue.CategoryKey(c.Name)));
            foreach (var g in c.Groups) Assert.NotNull(AchievementCatalogue.Find(AchievementCatalogue.GroupKey(g.Name)));
        }
        Assert.Equal("GROUP_UNDER_RIPE", AchievementCatalogue.GroupKey("UNDER-RIPE"));
    }

    [Fact]
    public void Wheel_leaves_agree_with_the_lexicon()
    {
        foreach (var c in FlavourWheel.Categories)
            foreach (var leaf in c.Leaves)
                Assert.Equal(c.Name, FlavourLexicon.Categorise(leaf));
        Assert.Equal(73, FlavourWheel.Leaves.Count);
    }

    [Fact]
    public void First_taste_needs_any_tag_of_either_polarity()
    {
        Assert.False(Eval("FIRST_TASTE").Unlocked);
        Assert.True(Eval("FIRST_TASTE", dislikes: 1).Unlocked);
        Assert.True(Eval("FIRST_TASTE", ["Peach"]).Unlocked);
    }

    [Fact]
    public void Category_and_group_rules_count_distinct_leaves_case_insensitively()
    {
        var p = Eval("ALL_OF_COCOA", ["dark chocolate", "Dark Chocolate", "Milk chocolate"]);
        Assert.Equal(new Progress(2, 4), p);
        Assert.True(Eval("ALL_OF_COCOA", ["Dark chocolate", "Milk chocolate", "Cocoa nibs", "Fudge"]).Unlocked);

        Assert.Equal(new Progress(3, 4), Eval("GROUP_BERRY", ["Blackberry", "Raspberry", "Blueberry", "Peach"]));
        Assert.True(Eval("GROUP_BERRY", ["Blackberry", "Raspberry", "Blueberry", "Strawberry"]).Unlocked);
    }

    [Fact]
    public void Tags_off_the_wheel_do_not_count_towards_coverage()
    {
        Assert.Equal(new Progress(0, 73), Eval("FULL_WHEEL", ["complex acidity", "Peachy"]));
        Assert.True(Eval("FIRST_TASTE", ["complex acidity"]).Unlocked);
    }

    [Fact]
    public void Cartographer_wants_one_leaf_in_every_wedge()
    {
        var oneEach = FlavourWheel.Categories.Select(c => c.Leaves.First()).ToList();
        Assert.Equal(new Progress(8, 9), Eval("CARTOGRAPHER", oneEach.Take(8)));
        Assert.True(Eval("CARTOGRAPHER", oneEach).Unlocked);
    }

    [Fact]
    public void Half_and_full_wheel_track_distinct_leaves()
    {
        var all = FlavourWheel.Leaves.ToList();
        Assert.Equal(new Progress(36, 37), Eval("HALF_WHEEL", all.Take(36)));
        Assert.True(Eval("HALF_WHEEL", all.Take(37)).Unlocked);
        Assert.False(Eval("FULL_WHEEL", all.Take(72)).Unlocked);
        Assert.True(Eval("FULL_WHEEL", all).Unlocked);
    }

    [Fact]
    public void Contrarian_counts_dislikes_only()
    {
        Assert.Equal(new Progress(9, 10), Eval("CONTRARIAN", ["Peach"], dislikes: 9));
        Assert.True(Eval("CONTRARIAN", dislikes: 10).Unlocked);
    }

    [Fact]
    public void Regular_needs_seven_brews_inside_a_rolling_week()
    {
        var daily = Enumerable.Range(0, 7).Select(d => T0.AddDays(d));
        Assert.True(Eval("REGULAR", brews: daily).Unlocked);

        var spread = Enumerable.Range(0, 7).Select(d => T0.AddDays(d * 1.2));
        Assert.Equal(new Progress(6, 7), Eval("REGULAR", brews: spread));

        var unordered = new[] { T0.AddDays(3), T0, T0.AddDays(6.9), T0.AddDays(1), T0.AddDays(2), T0.AddDays(5), T0.AddDays(4) };
        Assert.True(Eval("REGULAR", brews: unordered).Unlocked);
    }

    [Fact]
    public void Centurion_counts_brews()
    {
        Assert.Equal(new Progress(99, 100), Eval("CENTURION", brews: Enumerable.Range(0, 99).Select(i => T0.AddHours(i))));
        Assert.True(Eval("CENTURION", brews: Enumerable.Range(0, 100).Select(i => T0.AddHours(i))).Unlocked);
    }

    [Fact]
    public void Bag_rules_count_bags_and_distinct_named_roasters()
    {
        Assert.Equal(new Progress(4, 5), Eval("FIVE_BAGS", roasters: ["A", "A", null, "B"]));
        Assert.True(Eval("FIVE_BAGS", roasters: ["A", "A", null, "B", "C"]).Unlocked);
        Assert.Equal(new Progress(2, 3), Eval("THREE_ROASTERS", roasters: ["Symple", "symple ", null, "", "Tim Wendelboe"]));
        Assert.True(Eval("THREE_ROASTERS", roasters: ["Symple", "Tim Wendelboe", "Coffee Collective"]).Unlocked);
    }

    [Fact]
    public void Coverage_remembers_the_latest_tasting_per_leaf()
    {
        var facts = new AchievementFacts([], [
            new TagFact(Guid.NewGuid(), "peach", 1, T0),
            new TagFact(Guid.NewGuid(), "Peach", -1, T0.AddDays(2)),
            new TagFact(Guid.NewGuid(), "Peach", 1, T0.AddDays(1)),
        ], []);
        Assert.Equal(T0.AddDays(2), facts.Tasted["Peach"]);
        Assert.Single(facts.Tasted);
    }
}
