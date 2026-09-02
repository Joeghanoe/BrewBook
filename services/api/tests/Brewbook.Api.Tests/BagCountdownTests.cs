using Brewbook.Api.Domain;

namespace Brewbook.Api.Tests;

public class BagCountdownTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 2, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public void No_weight_means_no_countdown() => Assert.Null(BagCountdown.BrewsLeft(null, 45m, 15m));

    [Theory]
    [InlineData(250, 0, 15, 16)]
    [InlineData(250, 195, 15, 3)]
    [InlineData(250, 240, 15, 0)]   // less than a dose left rounds down to none
    [InlineData(250, 260, 15, 0)]   // scooped straight from the bag: never negative
    public void Counts_whole_brews_at_the_current_dose(decimal weight, decimal dosed, decimal next, int expected)
        => Assert.Equal(expected, BagCountdown.BrewsLeft(weight, dosed, next));

    [Fact]
    public void An_empty_bag_is_worth_asking_about()
    {
        var bean = new Bean { Name = "El Carmen", RoastDate = DateOnly.FromDateTime(Now.UtcDateTime) };
        Assert.True(BagCountdown.AskToArchive(bean, 0, Now));
        Assert.False(BagCountdown.AskToArchive(bean, 3, Now));
    }

    [Fact]
    public void So_is_a_bag_over_a_year_off_roast()
    {
        var stale = new Bean { Name = "Kieni", RoastDate = new DateOnly(2025, 8, 1) };
        var fresh = new Bean { Name = "Kieni", RoastDate = new DateOnly(2026, 8, 1) };
        Assert.True(BagCountdown.AskToArchive(stale, null, Now));
        Assert.False(BagCountdown.AskToArchive(fresh, null, Now));
    }

    [Fact]
    public void Quiet_is_not_a_trigger()
    {
        // A bag left alone for a month is a normal thing and not the app's business (§7).
        var bean = new Bean { Name = "El Carmen", RoastDate = new DateOnly(2026, 8, 1), WeightG = 250 };
        Assert.False(BagCountdown.AskToArchive(bean, 8, Now));
    }

    [Fact]
    public void Asked_once_then_never_again()
    {
        var bean = new Bean { Name = "El Carmen", ArchivePromptedAt = Now };
        Assert.False(BagCountdown.AskToArchive(bean, 0, Now));
    }

    [Fact]
    public void An_archived_bag_is_not_asked_about()
        => Assert.False(BagCountdown.AskToArchive(new Bean { Name = "Gone", Archived = true }, 0, Now));
}

public class PersonNameTests
{
    [Theory]
    [InlineData("Sam Okafor", "SO")]
    [InlineData("sam.okafor", "SO")]
    [InlineData("sam", "S")]
    [InlineData("Ada Marie Lovelace", "AL")]
    public void Initials_fit_on_a_pin(string name, string expected)
        => Assert.Equal(expected, Brewbook.Api.Features.Roasters.PersonName.Initials(name));

    [Fact]
    public void A_person_without_a_display_name_is_their_address_local_part()
        => Assert.Equal("sam", Brewbook.Api.Features.Roasters.PersonName.Of(new User { Email = "sam@example.com" }));
}
