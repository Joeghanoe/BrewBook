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

    private static readonly BrewParams Espresso = BrewParams.DefaultsFor(BrewMethod.Espresso); // 2.0 / 18 / 36 / 93 / pre 0 / 28 s

    [Theory]
    [InlineData("pre-infusion 8 seconds", 8)]
    [InlineData("pre infusion of ten seconds", 10)]
    [InlineData("preinfuse 5", 5)]
    [InlineData("no pre-infusion", 0)]
    public void Parses_pre_infusion_on_espresso(string said, int expected)
    {
        var r = VoiceCommandParser.Parse(said, Espresso with { PreInfusionS = 3 });
        Assert.Equal(expected, r.Params.PreInfusionS);
        Assert.Equal(Espresso.TargetMs, r.Params.TargetMs);
    }

    [Theory]
    [InlineData("shot 30 seconds", 30_000)]
    [InlineData("25 second shot", 25_000)]
    [InlineData("target time 32", 32_000)]
    public void Parses_shot_time_on_espresso(string said, int expected)
    {
        var r = VoiceCommandParser.Parse(said, Espresso);
        Assert.True(r.Applied);
        Assert.Equal(expected, r.Params.TargetMs);
    }

    [Fact]
    public void Pre_infusion_seconds_are_not_also_the_shot_time()
    {
        var r = VoiceCommandParser.Parse("pre-infusion 8 seconds", Espresso);
        Assert.Equal(8, r.Params.PreInfusionS);
        Assert.Equal(Espresso.TargetMs, r.Params.TargetMs);
    }

    [Theory]
    [InlineData("two blooms")]
    [InlineData("no bloom")]
    public void Blooms_mean_nothing_on_espresso(string said)
    {
        var r = VoiceCommandParser.Parse(said, Espresso);
        Assert.False(r.Applied);
        Assert.Equal(Espresso, r.Params);
    }

    [Theory]
    [InlineData("target 2:45", 165_000)]
    [InlineData("target two thirty", 150_000)]
    [InlineData("target time 3 00", 180_000)]
    [InlineData("two and a half minutes", 150_000)]
    [InlineData("time 2 minutes 45", 165_000)]
    [InlineData("3 minutes", 180_000)]
    public void Parses_target_time_on_filter(string said, int expected)
    {
        var r = VoiceCommandParser.Parse(said, Base with { TargetMs = 1000 });
        Assert.Equal(expected, r.Params.TargetMs);
        Assert.Equal(Base.Blooms, r.Params.Blooms);
        Assert.Equal(Base.TempC, r.Params.TempC);
    }

    [Fact]
    public void Pre_infusion_means_nothing_on_filter()
    {
        var r = VoiceCommandParser.Parse("pre-infusion 8 seconds", Base);
        Assert.Null(r.Params.PreInfusionS);
    }

    [Fact]
    public void Restating_the_current_value_is_not_a_change()
    {
        var r = VoiceCommandParser.Parse("94 degrees", Base);
        Assert.False(r.Applied);
    }
}
