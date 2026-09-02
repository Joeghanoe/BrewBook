using System.Net.Http.Json;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Brewbook.Api.Tests;

public class AchievementsApiTests
{
    private static readonly BrewParamsDto Defaults = new(4.5m, 15.0m, 250m, 94m, 2);

    [Fact]
    public async Task Tagging_stamps_first_taste_once()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen", "Symple");
        var brew = await CreateBrew(c, bean.Id);
        Assert.Empty(brew.NewlyUnlocked);

        var tagged = await Tag(c, brew.Id, new FlavourTagDto("Blackberry", 1), new FlavourTagDto("Smoky", -1));
        Assert.Contains(tagged.NewlyUnlocked, u => u.Key == "FIRST_TASTE" && u.Title == "First taste");

        // Same tags again: nothing new, and still one row.
        var again = await Tag(c, brew.Id, new FlavourTagDto("Blackberry", 1), new FlavourTagDto("Smoky", -1));
        Assert.Empty(again.NewlyUnlocked);
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BrewbookDbContext>();
            var rows = await db.Achievements.ToListAsync();
            Assert.Single(rows);
            Assert.Equal("FIRST_TASTE", rows[0].Key);
            Assert.Equal(brew.Id, rows[0].BrewId);
        }

        // Clearing the tags does not take the stamp back.
        var cleared = await Tag(c, brew.Id);
        Assert.Empty(cleared.NewlyUnlocked);
        var passport = await c.GetFromJsonAsync<AchievementsResponse>("/api/v1/achievements");
        Assert.True(passport!.Achievements.Single(a => a.Key == "FIRST_TASTE").Unlocked);
    }

    [Fact]
    public async Task Completing_a_group_stamps_it_on_the_tag_write()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen", "Symple");
        var b1 = await CreateBrew(c, bean.Id);
        var b2 = await CreateBrew(c, bean.Id);

        await Tag(c, b1.Id, new FlavourTagDto("Blackberry", 1), new FlavourTagDto("Raspberry", 1));
        var done = await Tag(c, b2.Id, new FlavourTagDto("Blueberry", 1), new FlavourTagDto("strawberry", -1));
        Assert.Contains(done.NewlyUnlocked, u => u.Key == "GROUP_BERRY" && u.Title == "Berry picker");
        Assert.DoesNotContain(done.NewlyUnlocked, u => u.Key == "FIRST_TASTE");
    }

    [Fact]
    public async Task Seven_brews_stamp_regular_on_the_seventh()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen", "Symple");
        for (var i = 1; i <= 6; i++) Assert.Empty((await CreateBrew(c, bean.Id)).NewlyUnlocked);
        var seventh = await CreateBrew(c, bean.Id);
        Assert.Equal(["REGULAR"], seventh.NewlyUnlocked.Select(u => u.Key));
    }

    [Fact]
    public async Task Passport_reports_progress_and_coverage_per_user()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bob = f.ClientFor("bob@example.com");
        var bean = await CreateBean(ada, "El Carmen", "Symple");
        await CreateBean(ada, "Kiiro", "Tim Wendelboe");
        var brew = await CreateBrew(ada, bean.Id);
        await Tag(ada, brew.Id, new FlavourTagDto("Peach", 1), new FlavourTagDto("Cherry", -1), new FlavourTagDto("complex acidity", 1));

        var p = (await ada.GetFromJsonAsync<AchievementsResponse>("/api/v1/achievements"))!;
        var first = p.Achievements.Single(a => a.Key == "FIRST_TASTE");
        Assert.True(first.Unlocked);
        Assert.NotNull(first.UnlockedAt);
        Assert.Equal(new ProgressDto(1, 1), first.Progress);

        var stone = p.Achievements.Single(a => a.Key == "GROUP_STONE");
        Assert.False(stone.Unlocked);
        Assert.Null(stone.UnlockedAt);
        Assert.Equal(new ProgressDto(2, 3), stone.Progress);
        Assert.Equal(new ProgressDto(2, 3), p.Achievements.Single(a => a.Key == "THREE_ROASTERS").Progress);
        Assert.Equal(new ProgressDto(2, 5), p.Achievements.Single(a => a.Key == "FIVE_BAGS").Progress);

        Assert.Equal(73, p.Coverage.Leaves.Count);
        var peach = p.Coverage.Leaves.Single(l => l.Flavour == "Peach");
        Assert.True(peach.Tasted);
        Assert.Equal(brew.BrewedAt, peach.LastTaggedAt);
        Assert.Equal("FRUITY", peach.Category);
        Assert.Equal("STONE", peach.Group);
        Assert.True(p.Coverage.Leaves.Single(l => l.Flavour == "Cherry").Tasted);
        var plum = p.Coverage.Leaves.Single(l => l.Flavour == "Plum");
        Assert.False(plum.Tasted);
        Assert.Null(plum.LastTaggedAt);
        Assert.Equal(9, p.Coverage.Categories.Count);
        Assert.Equal(new CategoryCoverageDto("FRUITY", 2, 15), p.Coverage.Categories.Single(x => x.Name == "FRUITY"));

        var bobs = (await bob.GetFromJsonAsync<AchievementsResponse>("/api/v1/achievements"))!;
        Assert.All(bobs.Achievements, a => Assert.False(a.Unlocked));
        Assert.All(bobs.Coverage.Leaves, l => Assert.False(l.Tasted));
    }

    [Fact]
    public async Task Undoing_the_stamping_brew_keeps_the_stamp()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen", "Symple");
        var brew = await CreateBrew(c, bean.Id);
        await Tag(c, brew.Id, new FlavourTagDto("Peach", 1));
        (await c.DeleteAsync($"/api/v1/brews/{brew.Id}")).EnsureSuccessStatusCode();

        var p = (await c.GetFromJsonAsync<AchievementsResponse>("/api/v1/achievements"))!;
        Assert.True(p.Achievements.Single(a => a.Key == "FIRST_TASTE").Unlocked);
        Assert.False(p.Coverage.Leaves.Single(l => l.Flavour == "Peach").Tasted);
        using var scope = f.Services.CreateScope();
        var row = await scope.ServiceProvider.GetRequiredService<BrewbookDbContext>().Achievements.SingleAsync();
        Assert.Null(row.BrewId);
    }

    private static async Task<BeanResponse> CreateBean(HttpClient c, string name, string roaster)
    {
        var res = await c.PostAsJsonAsync("/api/v1/beans", new CreateBeanRequest(name, roaster, null, null, null, null, null, null, null, null, null));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BeanResponse>())!;
    }

    private static async Task<BrewResponse> CreateBrew(HttpClient c, Guid beanId)
    {
        var res = await c.PostAsJsonAsync("/api/v1/brews", new CreateBrewRequest(beanId, Defaults, 150_000, null));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BrewResponse>())!;
    }

    private static async Task<BrewResponse> Tag(HttpClient c, Guid brewId, params FlavourTagDto[] tags)
    {
        var res = await c.PutAsJsonAsync($"/api/v1/brews/{brewId}/tags", new TagBrewRequest(tags));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BrewResponse>())!;
    }
}
