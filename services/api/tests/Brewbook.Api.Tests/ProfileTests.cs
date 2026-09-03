using System.Net.Http.Json;
using Brewbook.Api.Contracts;
using Brewbook.Api.Domain;
using Brewbook.Api.Features.Profile;

namespace Brewbook.Api.Tests;

public class ProfileTests
{
    private static readonly BrewParamsDto Defaults = new(4.5m, 15.0m, 250m, 94m, 2);

    [Fact]
    public async Task Profile_is_empty_before_the_first_brew()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        await CreateBean(c, "El Carmen", "Symple");

        var p = await c.GetFromJsonAsync<ProfileResponse>("/api/v1/profile");

        Assert.NotNull(p);
        Assert.Equal("ada@example.com", p.Email);
        Assert.Equal(new ProfileCounts(0, 1, 0, 0), p.Counts);
        Assert.Null(p.Preferences.Preferred);
        Assert.Null(p.Preferences.Overall);
        Assert.Null(p.Preferences.TypicalDurationMs);
        Assert.Equal(9, p.Flavours.Categories.Count);
        Assert.All(p.Flavours.Categories, cat => Assert.Equal(0, cat.Likes + cat.Dislikes));
        Assert.Empty(p.TopBeans);
        Assert.Single(p.Roasters);
        Assert.Null(p.Roasters[0].AvgRating);
    }

    [Fact]
    public async Task Profile_folds_brews_and_tags_across_bags()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var carmen = await CreateBean(c, "El Carmen", "Symple");
        var kiiro = await CreateBean(c, "Kiiro", " SYMPLE ");    // same roaster, different spelling; newest bag wins
        var loner = await CreateBean(c, "Loner", "Dak");

        var b1 = await CreateBrew(c, carmen.Id, Defaults with { Grind = 4.0m, TempC = 93m }, 150_000);
        var b2 = await CreateBrew(c, carmen.Id, Defaults with { Grind = 4.0m, TempC = 93m }, 160_000);
        var b3 = await CreateBrew(c, kiiro.Id, Defaults with { Grind = 5.0m, TempC = 95m, Blooms = 3 }, 170_000);
        var b4 = await CreateBrew(c, loner.Id, Defaults with { Grind = 5.5m }, 180_000);

        await Rate(c, b1.Id, 5, []);
        await Rate(c, b2.Id, 4, ["Sour"]);
        await Rate(c, b3.Id, 2, ["Sour", "Bitter"]);
        // b4 stays unrated.

        await Tag(c, b1.Id, [new("Blackberry", 1), new("Peach", 1), new("Smoky", -1)]);
        await Tag(c, b2.Id, [new("blackberry", 1), new("Jasmine", 1)]);
        await Tag(c, b3.Id, [new("Smoky", -1), new("Ashy", -1)]);

        var p = (await c.GetFromJsonAsync<ProfileResponse>("/api/v1/profile"))!;

        Assert.Equal(new ProfileCounts(Brews: 4, Bags: 3, Flavours: 5, DaysLogging: 1), p.Counts);

        // Leaves group case-insensitively and carry the wheel category.
        var blackberry = Assert.Single(p.Flavours.Leaves, l => l.Flavour.Equals("blackberry", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(2, blackberry.Likes);
        Assert.Equal("FRUITY", blackberry.Category);
        var smoky = Assert.Single(p.Flavours.Leaves, l => l.Flavour == "Smoky");
        Assert.Equal(2, smoky.Dislikes);
        Assert.Equal("ROASTED", smoky.Category);

        Assert.Equal(["FRUITY", "FLORAL", "SWEET", "NUTTY", "COCOA", "SPICES", "ROASTED", "GREEN", "OTHER"], p.Flavours.Categories.Select(x => x.Category));
        Assert.Equal(new ProfileCategory("FRUITY", 3, 0), p.Flavours.Categories[0]);
        Assert.Equal(new ProfileCategory("ROASTED", 0, 3), p.Flavours.Categories[6]);

        Assert.Equal("blackberry", p.Flavours.TopLiked[0].Flavour, ignoreCase: true);
        Assert.Equal(3, p.Flavours.TopLiked.Count);
        Assert.Equal(["Smoky", "Ashy"], p.Flavours.TopDisliked.Select(x => x.Flavour));

        // Preferred = medians of the two brews rated 4+; overall = medians of all four.
        Assert.Equal(3, p.Preferences.RatedBrews);
        Assert.Equal(2, p.Preferences.LikedBrews);
        Assert.Equal(new BrewParamsDto(4.0m, 15.0m, 250m, 93m, 2), p.Preferences.Preferred);
        Assert.Equal(new BrewParamsDto(4.5m, 15.0m, 250m, 93.5m, 2), p.Preferences.Overall);
        Assert.Equal(165_000, p.Preferences.TypicalDurationMs);
        Assert.Equal([new ProfileDefect("Sour", 2), new ProfileDefect("Bitter", 1)], p.Preferences.Defects);

        // Bags: average over rated brews only, best = highest rating.
        var carmenRow = Assert.Single(p.Beans, b => b.BeanId == carmen.Id);
        Assert.Equal(2, carmenRow.Brews);
        Assert.Equal(4.5m, carmenRow.AvgRating);
        Assert.Equal(b1.Id, carmenRow.BestBrewId);
        var lonerRow = Assert.Single(p.Beans, b => b.BeanId == loner.Id);
        Assert.Null(lonerRow.AvgRating);
        Assert.Null(lonerRow.BestBrewId);
        Assert.Equal([carmen.Id, kiiro.Id], p.TopBeans.Select(b => b.BeanId));

        // Roasters merge on trimmed, case-insensitive text.
        Assert.Equal(2, p.Roasters.Count);
        var symple = p.Roasters[0];
        Assert.Equal("SYMPLE", symple.Roaster);
        Assert.Equal(2, symple.Bags);
        Assert.Equal(3, symple.Brews);
        Assert.Equal(3.67m, symple.AvgRating);
        Assert.Equal("blackberry", symple.TopFlavours[0], ignoreCase: true);
        Assert.Equal("Dak", p.Roasters[1].Roaster);
        Assert.Empty(p.Roasters[1].TopFlavours);
    }

    [Fact]
    public async Task Preferences_follow_the_method_brewed_most_and_skip_untimed_brews()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "Carmen", "Symple");
        var espresso = new BrewParamsDto(2.0m, 18m, 36m, 93m, 0, BrewMethod.Espresso, 6, 28_000);
        await CreateBrew(c, bean.Id, espresso, 27_000);
        await CreateBrew(c, bean.Id, espresso with { Grind = 2.4m, PreInfusionS = 8 }, 0);
        await CreateBrew(c, bean.Id, Defaults, 150_000);

        var p = (await c.GetFromJsonAsync<ProfileResponse>("/api/v1/profile"))!;
        Assert.Equal(BrewMethod.Espresso, p.Preferences.Overall!.Method);
        Assert.Equal(2.2m, p.Preferences.Overall.Grind);
        Assert.Equal(7, p.Preferences.Overall.PreInfusionS);
        Assert.Equal(27_000, p.Preferences.TypicalDurationMs);
    }

    [Fact]
    public async Task Profile_only_counts_the_callers_log()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bob = f.ClientFor("bob@example.com");
        var bobBean = await CreateBean(bob, "Kiiro", "Dak");
        var bobBrew = await CreateBrew(bob, bobBean.Id, Defaults, 150_000);
        await Tag(bob, bobBrew.Id, [new("Peach", 1)]);

        var p = (await ada.GetFromJsonAsync<ProfileResponse>("/api/v1/profile"))!;
        Assert.Equal(new ProfileCounts(0, 0, 0, 0), p.Counts);
        Assert.Empty(p.Roasters);
    }

    [Fact]
    public void Builder_ignores_tags_of_brews_it_was_not_given()
    {
        var user = new User { Id = Guid.NewGuid(), Email = "ada@example.com" };
        var stray = new FlavourTag { BrewId = Guid.NewGuid(), Flavour = "Peach", Polarity = 1 };
        var p = ProfileBuilder.Build(user, [], [], [stray]);
        Assert.Empty(p.Flavours.Leaves);
        Assert.Equal(0, p.Counts.Flavours);
    }

    private static async Task<BeanResponse> CreateBean(HttpClient c, string name, string roaster)
    {
        var res = await c.PostAsJsonAsync("/api/v1/beans", new CreateBeanRequest(name, roaster, null, null, null, null, null, null, null, null, null, null));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BeanResponse>())!;
    }

    private static async Task<BrewResponse> CreateBrew(HttpClient c, Guid beanId, BrewParamsDto p, int durationMs)
    {
        var res = await c.PostAsJsonAsync("/api/v1/brews", new CreateBrewRequest(beanId, p, durationMs, null));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BrewResponse>())!;
    }

    private static async Task Rate(HttpClient c, Guid brewId, int rating, string[] defects) =>
        (await c.PatchAsJsonAsync($"/api/v1/brews/{brewId}/rating", new RateBrewRequest(rating, defects))).EnsureSuccessStatusCode();

    private static async Task Tag(HttpClient c, Guid brewId, FlavourTagDto[] tags) =>
        (await c.PutAsJsonAsync($"/api/v1/brews/{brewId}/tags", new TagBrewRequest(tags))).EnsureSuccessStatusCode();
}
