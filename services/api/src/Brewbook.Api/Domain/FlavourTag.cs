namespace Brewbook.Api.Domain;

public sealed class FlavourTag
{
    public Guid BrewId { get; set; }
    public Brew? Brew { get; set; }
    public required string Flavour { get; set; }
    /// <summary>+1 tagged, -1 disliked.</summary>
    public int Polarity { get; set; }
}
