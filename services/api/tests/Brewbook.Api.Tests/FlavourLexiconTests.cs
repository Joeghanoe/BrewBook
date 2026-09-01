using Brewbook.Api.Features.Labels;

namespace Brewbook.Api.Tests;

public class FlavourLexiconTests
{
    [Theory]
    [InlineData("Jasmine", "FLORAL")]
    [InlineData("peach", "FRUITY")]
    [InlineData("Ripe blackberry", "FRUITY")]
    [InlineData("Panela", "SWEET")]
    [InlineData("Dark chocolate", "COCOA")]
    public void Maps_declared_notes_to_wheel_categories(string note, string expected)
        => Assert.Equal(expected, FlavourLexicon.Categorise(note));

    [Fact]
    public void Unmappable_text_stays_uncategorised()
        => Assert.Null(FlavourLexicon.Categorise("\"complex acidity\""));
}
