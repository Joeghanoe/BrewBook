namespace Brewbook.Api.Domain;

/// <summary>
/// One named moment in a brew: "bloom" at 0:00, "pour" at 0:45. Spoken during the brew or dropped
/// by a long press. Stored as JSON on the brew; <see cref="Brew.PourMarkersMs"/> carries the times
/// alone for readers that predate labels.
/// </summary>
public sealed class BrewStep
{
    public const int MaxLabelLength = 40;

    public int AtMs { get; set; }
    public string Label { get; set; } = "";
}
