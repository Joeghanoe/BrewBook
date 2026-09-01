using Brewbook.Api.Contracts;

namespace Brewbook.Api.Features.Labels;

public interface ILabelExtractor
{
    bool Configured { get; }
    Task<LabelScanResponse> ExtractAsync(byte[] image, string mediaType, CancellationToken ct);
}

/// <summary>Maps a roaster's declared tasting note onto a flavour-wheel category.</summary>
public static class FlavourLexicon
{
    public static readonly IReadOnlyList<string> Categories =
        ["FRUITY", "FLORAL", "SWEET", "NUTTY", "COCOA", "SPICES", "ROASTED", "GREEN", "OTHER"];

    private static readonly Dictionary<string, string> Map = new(StringComparer.OrdinalIgnoreCase)
    {
        // FRUITY
        ["blackberry"] = "FRUITY", ["raspberry"] = "FRUITY", ["blueberry"] = "FRUITY", ["strawberry"] = "FRUITY",
        ["peach"] = "FRUITY", ["cherry"] = "FRUITY", ["plum"] = "FRUITY", ["apricot"] = "FRUITY", ["nectarine"] = "FRUITY",
        ["raisin"] = "FRUITY", ["prune"] = "FRUITY", ["fig"] = "FRUITY", ["date"] = "FRUITY", ["dried fruit"] = "FRUITY",
        ["lemon"] = "FRUITY", ["lime"] = "FRUITY", ["orange"] = "FRUITY", ["grapefruit"] = "FRUITY", ["bergamot"] = "FRUITY",
        ["citrus"] = "FRUITY", ["apple"] = "FRUITY", ["pear"] = "FRUITY", ["grape"] = "FRUITY", ["mango"] = "FRUITY",
        ["pineapple"] = "FRUITY", ["papaya"] = "FRUITY", ["passion fruit"] = "FRUITY", ["passionfruit"] = "FRUITY",
        ["lychee"] = "FRUITY", ["melon"] = "FRUITY", ["tropical"] = "FRUITY", ["berry"] = "FRUITY", ["berries"] = "FRUITY",
        ["red fruit"] = "FRUITY", ["stone fruit"] = "FRUITY", ["currant"] = "FRUITY", ["blackcurrant"] = "FRUITY",
        // FLORAL
        ["jasmine"] = "FLORAL", ["rose"] = "FLORAL", ["chamomile"] = "FLORAL", ["lavender"] = "FLORAL", ["hibiscus"] = "FLORAL",
        ["orange blossom"] = "FLORAL", ["elderflower"] = "FLORAL", ["floral"] = "FLORAL", ["flowers"] = "FLORAL", ["black tea"] = "FLORAL",
        ["earl grey"] = "FLORAL", ["tea"] = "FLORAL",
        // SWEET
        ["honey"] = "SWEET", ["caramel"] = "SWEET", ["panela"] = "SWEET", ["brown sugar"] = "SWEET", ["molasses"] = "SWEET",
        ["maple"] = "SWEET", ["maple syrup"] = "SWEET", ["vanilla"] = "SWEET", ["toffee"] = "SWEET", ["butterscotch"] = "SWEET",
        ["sugar cane"] = "SWEET", ["syrup"] = "SWEET", ["sweet"] = "SWEET", ["candy"] = "SWEET", ["marshmallow"] = "SWEET",
        // NUTTY
        ["almond"] = "NUTTY", ["hazelnut"] = "NUTTY", ["peanut"] = "NUTTY", ["walnut"] = "NUTTY", ["pecan"] = "NUTTY",
        ["nutty"] = "NUTTY", ["nuts"] = "NUTTY", ["marzipan"] = "NUTTY", ["praline"] = "NUTTY",
        // COCOA
        ["chocolate"] = "COCOA", ["dark chocolate"] = "COCOA", ["milk chocolate"] = "COCOA", ["cocoa"] = "COCOA", ["cacao"] = "COCOA",
        ["cocoa nibs"] = "COCOA", ["fudge"] = "COCOA",
        // SPICES
        ["cinnamon"] = "SPICES", ["clove"] = "SPICES", ["nutmeg"] = "SPICES", ["cardamom"] = "SPICES", ["anise"] = "SPICES",
        ["pepper"] = "SPICES", ["black pepper"] = "SPICES", ["ginger"] = "SPICES", ["spice"] = "SPICES", ["spices"] = "SPICES",
        ["spicy"] = "SPICES", ["liquorice"] = "SPICES", ["licorice"] = "SPICES",
        // ROASTED
        ["toast"] = "ROASTED", ["smoky"] = "ROASTED", ["smoke"] = "ROASTED", ["tobacco"] = "ROASTED", ["pipe tobacco"] = "ROASTED",
        ["burnt"] = "ROASTED", ["ashy"] = "ROASTED", ["cereal"] = "ROASTED", ["malt"] = "ROASTED", ["malty"] = "ROASTED",
        ["grain"] = "ROASTED", ["bread"] = "ROASTED", ["roasted"] = "ROASTED",
        // GREEN
        ["grassy"] = "GREEN", ["grass"] = "GREEN", ["herbal"] = "GREEN", ["herbs"] = "GREEN", ["vegetal"] = "GREEN", ["green"] = "GREEN",
        ["hay"] = "GREEN", ["pea"] = "GREEN", ["olive"] = "GREEN", ["raw"] = "GREEN", ["under-ripe"] = "GREEN", ["underripe"] = "GREEN",
        // OTHER
        ["winey"] = "OTHER", ["wine"] = "OTHER", ["red wine"] = "OTHER", ["boozy"] = "OTHER", ["rum"] = "OTHER", ["whisky"] = "OTHER",
        ["whiskey"] = "OTHER", ["fermented"] = "OTHER", ["funky"] = "OTHER", ["earthy"] = "OTHER", ["musty"] = "OTHER",
        ["woody"] = "OTHER", ["cedar"] = "OTHER", ["papery"] = "OTHER", ["rubber"] = "OTHER", ["medicinal"] = "OTHER",
        ["creamy"] = "OTHER", ["buttery"] = "OTHER", ["silky"] = "OTHER", ["juicy"] = "OTHER", ["bright"] = "OTHER",
    };

    public static string? Categorise(string note)
    {
        var n = note.Trim().Trim('"', '“', '”').ToLowerInvariant();
        if (Map.TryGetValue(n, out var c)) return c;
        // "ripe blackberry" → blackberry; longest key contained in the note wins.
        return Map.Where(kv => n.Contains(kv.Key, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(kv => kv.Key.Length)
            .Select(kv => kv.Value)
            .FirstOrDefault();
    }
}

/// <summary>Used when no extraction provider is configured. Says so, and hands every field to the user.</summary>
public sealed class UnconfiguredLabelExtractor : ILabelExtractor
{
    public bool Configured => false;

    public Task<LabelScanResponse> ExtractAsync(byte[] image, string mediaType, CancellationToken ct)
    {
        var missing = new ExtractedField(null, Provenance.Missing);
        return Task.FromResult(new LabelScanResponse(
            ScanId: Guid.NewGuid().ToString("N"),
            Extracted: false,
            Reason: "Label reading is not configured on this deployment — fill the bag in by hand.",
            missing, missing, missing, missing, missing, missing, missing, missing, missing,
            DeclaredNotes: []));
    }
}
