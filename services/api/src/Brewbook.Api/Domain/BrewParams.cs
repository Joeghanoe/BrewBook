namespace Brewbook.Api.Domain;

/// <summary>The five adjustable ticket values. Every brew, delta and voice command is expressed in these.</summary>
public sealed record BrewParams(decimal Grind, decimal DoseG, decimal YieldG, decimal TempC, int Blooms)
{
    /// <summary>The method's defaults: what the first brew of a bean starts from.</summary>
    public static readonly BrewParams MethodDefaults = new(4.5m, 15.0m, 250m, 94m, 2);

    public static BrewParams From(Brew b) => new(b.Grind, b.DoseG, b.YieldG, b.TempC, b.Blooms);
}
