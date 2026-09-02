namespace Brewbook.Api.Features.Labels;

public sealed record WheelGroup(string Name, IReadOnlyList<string> Leaves);

public sealed record WheelCategory(string Name, IReadOnlyList<WheelGroup> Groups)
{
    public IEnumerable<string> Leaves => Groups.SelectMany(g => g.Leaves);
}

/// <summary>
/// The nine-wedge wheel the client tags on. Mirrors services/web/src/lib/flavours.ts leaf for leaf;
/// change both in the same commit. Tags are stored as the leaf text, so matching is by name.
/// </summary>
public static class FlavourWheel
{
    public static readonly IReadOnlyList<WheelCategory> Categories =
    [
        new("FRUITY",
        [
            new("BERRY", ["Blackberry", "Raspberry", "Blueberry", "Strawberry"]),
            new("DRIED", ["Raisin", "Prune", "Fig", "Date"]),
            new("CITRUS", ["Lemon", "Lime", "Orange", "Grapefruit"]),
            new("STONE", ["Peach", "Cherry", "Plum"]),
        ]),
        new("FLORAL",
        [
            new("FLOWERS", ["Jasmine", "Rose", "Chamomile", "Lavender"]),
            new("TEA", ["Black tea", "Earl grey", "Hibiscus"]),
        ]),
        new("SWEET",
        [
            new("SUGARS", ["Honey", "Caramel", "Panela", "Brown sugar", "Molasses"]),
            new("CONFECTION", ["Vanilla", "Toffee", "Butterscotch", "Maple"]),
        ]),
        new("NUTTY",
        [
            new("NUTS", ["Almond", "Hazelnut", "Peanut", "Walnut", "Pecan"]),
            new("PASTE", ["Marzipan", "Praline"]),
        ]),
        new("COCOA",
        [
            new("CHOCOLATE", ["Dark chocolate", "Milk chocolate", "Cocoa nibs", "Fudge"]),
        ]),
        new("SPICES",
        [
            new("WARM", ["Cinnamon", "Clove", "Nutmeg", "Cardamom"]),
            new("SHARP", ["Black pepper", "Anise", "Ginger", "Liquorice"]),
        ]),
        new("ROASTED",
        [
            new("TOASTED", ["Toast", "Cereal", "Malt", "Bread"]),
            new("SMOKY", ["Smoky", "Tobacco", "Burnt", "Ashy"]),
        ]),
        new("GREEN",
        [
            new("VEGETAL", ["Grassy", "Herbal", "Hay", "Pea"]),
            new("UNDER-RIPE", ["Under-ripe", "Raw", "Olive"]),
        ]),
        new("OTHER",
        [
            new("FERMENTED", ["Winey", "Boozy", "Funky", "Fermented"]),
            new("TEXTURE", ["Creamy", "Juicy", "Woody", "Papery"]),
        ]),
    ];

    public static readonly IReadOnlyList<string> Leaves = Categories.SelectMany(c => c.Leaves).ToList();

    private static readonly Dictionary<string, (WheelCategory Category, WheelGroup Group)> Index = BuildIndex();

    private static Dictionary<string, (WheelCategory, WheelGroup)> BuildIndex()
    {
        var d = new Dictionary<string, (WheelCategory, WheelGroup)>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in Categories)
            foreach (var g in c.Groups)
                foreach (var l in g.Leaves)
                    d[l] = (c, g);
        return d;
    }

    /// <summary>The canonical leaf text for a tag, or null when the tag is not on the wheel.</summary>
    public static string? Canonical(string flavour)
        => Index.TryGetValue(flavour.Trim(), out var hit) ? hit.Group.Leaves.First(l => string.Equals(l, flavour.Trim(), StringComparison.OrdinalIgnoreCase)) : null;

    public static WheelCategory? CategoryOf(string leaf) => Index.TryGetValue(leaf.Trim(), out var hit) ? hit.Category : null;
    public static WheelGroup? GroupOf(string leaf) => Index.TryGetValue(leaf.Trim(), out var hit) ? hit.Group : null;
}
