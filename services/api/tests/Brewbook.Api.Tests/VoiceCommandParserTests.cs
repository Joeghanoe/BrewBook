using Brewbook.Api.Domain;
using Brewbook.Api.Features.Voice;

namespace Brewbook.Api.Tests;

public class VoiceCommandParserTests
{
    private static readonly BrewParams Base = BrewParams.MethodDefaults; // 4.5 / 15.0 / 250 / 94 / 2

    [Theory]
    [InlineData("same but 93 degrees", 93)]
    [InlineData("ninety three degrees", 93)]
    [InlineData("water at 92", 92)]
    [InlineData("temperature to 90 c", 90)]
    [InlineData("one degree hotter", 95)]
    [InlineData("two degrees lower", 92)]
    public void Parses_water_temperature(string said, int expected)
    {
        var r = VoiceCommandParser.Parse(said, Base);
        Assert.True(r.Applied);
        Assert.Equal(expected, r.Params.TempC);
        Assert.Equal(Base with { TempC = expected }, r.Params);
    }

    [Theory]
    [InlineData("half a click finer", 4.0)]
    [InlineData("grind finer", 3.5)]
    [InlineData("one click coarser", 5.5)]
    [InlineData("grind 6", 6.0)]
    [InlineData("0.5 coarser", 5.0)]
    public void Parses_grind(string said, double expected)
    {
        var r = VoiceCommandParser.Parse(said, Base);
        Assert.Equal((decimal)expected, r.Params.Grind);
        Assert.Equal(Base with { Grind = (decimal)expected }, r.Params);
    }

    [Theory]
    [InlineData("dose 16", 16.0, 250)]
    [InlineData("16 grams of coffee", 16.0, 250)]
    [InlineData("one gram more coffee", 16.0, 250)]
    [InlineData("yield 260", 15.0, 260)]
    [InlineData("ten grams more water", 15.0, 260)]
    [InlineData("240 grams out", 15.0, 240)]
    public void Distinguishes_dose_from_yield(string said, double dose, int yield)
    {
        var r = VoiceCommandParser.Parse(said, Base);
        Assert.Equal((decimal)dose, r.Params.DoseG);
        Assert.Equal(yield, r.Params.YieldG);
        Assert.Equal(Base.TempC, r.Params.TempC);
    }

    [Theory]
    [InlineData("three blooms", 3)]
    [InlineData("one more bloom", 3)]
    [InlineData("no bloom", 0)]
    [InlineData("skip the bloom", 0)]
    public void Parses_blooms(string said, int expected)
    {
        var r = VoiceCommandParser.Parse(said, Base);
        Assert.Equal(expected, r.Params.Blooms);
    }

    [Fact]
    public void Applies_several_changes_in_one_utterance()
    {
        var r = VoiceCommandParser.Parse("93 degrees and half a click finer", Base);
        Assert.Equal(93, r.Params.TempC);
        Assert.Equal(4.0m, r.Params.Grind);
        Assert.Equal(2, r.Changes.Count);
    }

    [Theory]
    [InlineData("")]
    [InlineData("hello there")]
    [InlineData("make it taste better")]
    public void Unrecognised_speech_changes_nothing(string said)
    {
        var r = VoiceCommandParser.Parse(said, Base);
        Assert.False(r.Applied);
        Assert.Equal(Base, r.Params);
    }

    [Fact]
    public void Restating_the_current_value_is_not_a_change()
    {
        var r = VoiceCommandParser.Parse("94 degrees", Base);
        Assert.False(r.Applied);
    }
}
