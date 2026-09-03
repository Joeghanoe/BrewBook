namespace Brewbook.Api.Domain;

/// <summary>
/// The ticket: the method and every adjustable value the next brew will use. Every brew, delta and
/// voice command is expressed in these. <see cref="Blooms"/> only means something for filter and
/// <see cref="PreInfusionS"/> only for espresso; <see cref="Normalised"/> blanks the one that does
/// not apply so two tickets that brew the same compare equal.
/// </summary>
public sealed record BrewParams(BrewMethod Method, decimal Grind, decimal DoseG, decimal YieldG, decimal TempC, int Blooms, int? PreInfusionS, int TargetMs)
{
    public const int FilterTargetMs = 150_000;
    public const int EspressoTargetMs = 28_000;

    /// <summary>What the first brew of a bag starts from, per method.</summary>
    public static BrewParams DefaultsFor(BrewMethod method) => method switch
    {
        // Espresso grind is a placeholder: grinder scales differ, and the number is the user's to set.
        BrewMethod.Espresso => new(method, 2.0m, 18.0m, 36m, 93m, 0, 0, EspressoTargetMs),
        _ => new(BrewMethod.Filter, 4.5m, 15.0m, 250m, 94m, 2, null, FilterTargetMs),
    };

    /// <summary>The filter defaults; the method a bag starts on when nothing says otherwise.</summary>
    public static readonly BrewParams MethodDefaults = DefaultsFor(BrewMethod.Filter);

    public static BrewParams From(Brew b) => new(b.Method, b.Grind, b.DoseG, b.YieldG, b.TempC, b.Blooms, b.PreInfusionS, b.TargetMs);

    public BrewParams Normalised() => Method == BrewMethod.Espresso
        ? this with { Blooms = 0, PreInfusionS = PreInfusionS ?? 0 }
        : this with { PreInfusionS = null };
}
