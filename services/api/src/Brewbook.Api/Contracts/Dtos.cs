using Brewbook.Api.Domain;

namespace Brewbook.Api.Contracts;

// Wire shapes. Versioned by route prefix (/api/v1). Add fields; never repurpose one.

public sealed record FeatureFlags(bool LabelReading, bool SpeechTranscription);

public sealed record MeResponse(Guid Id, string Email, string? DisplayName, FeatureFlags Features, DateTimeOffset? OnboardedAt)
{
    public static MeResponse From(User u, FeatureFlags features) => new(u.Id, u.Email, u.DisplayName, features, u.OnboardedAt);
}

public sealed record BrewParamsDto(decimal Grind, decimal DoseG, decimal YieldG, decimal TempC, int Blooms)
{
    public static BrewParamsDto From(BrewParams p) => new(p.Grind, p.DoseG, p.YieldG, p.TempC, p.Blooms);
    public BrewParams ToDomain() => new(Grind, DoseG, YieldG, TempC, Blooms);
}

public sealed record BeanResponse(
    Guid Id,
    string Name,
    string? Roaster,
    string? Origin,
    string? Process,
    DateOnly? RoastDate,
    string? Producer,
    string? Varietal,
    string? Altitude,
    string? RoastLevel,
    IReadOnlyList<string> DeclaredNotes,
    bool Archived,
    bool LabelKept,
    DateTimeOffset CreatedAt,
    int BrewCount,
    DateTimeOffset? LastBrewedAt,
    /// <summary>Params of the most recent brew, or the method defaults when the bean has none.</summary>
    BrewParamsDto LastParams)
{
    public static BeanResponse From(Bean b, int brewCount, Brew? last) => new(
        b.Id, b.Name, b.Roaster, b.Origin, b.Process, b.RoastDate, b.Producer, b.Varietal, b.Altitude, b.RoastLevel,
        b.DeclaredNotes, b.Archived, b.LabelScanId is not null, b.CreatedAt, brewCount, last?.BrewedAt,
        BrewParamsDto.From(last is null ? BrewParams.MethodDefaults : BrewParams.From(last)));
}

public sealed record CreateBeanRequest(
    string Name,
    string? Roaster,
    string? Origin,
    string? Process,
    DateOnly? RoastDate,
    string? Producer,
    string? Varietal,
    string? Altitude,
    string? RoastLevel,
    IReadOnlyList<string>? DeclaredNotes,
    string? LabelScanId);

public sealed record UpdateBeanRequest(bool? Archived);

public sealed record FlavourTagDto(string Flavour, int Polarity);

public sealed record BrewResponse(
    Guid Id,
    Guid BeanId,
    int Number,
    BrewParamsDto Params,
    int DurationMs,
    IReadOnlyList<int> PourMarkersMs,
    int Rating,
    IReadOnlyList<string> Defects,
    IReadOnlyList<FlavourTagDto> FlavourTags,
    DateTimeOffset BrewedAt)
{
    public static BrewResponse From(Brew b) => new(
        b.Id, b.BeanId, b.Number, BrewParamsDto.From(BrewParams.From(b)), b.DurationMs, b.PourMarkersMs, b.Rating, b.Defects,
        b.FlavourTags.OrderBy(t => t.Flavour).Select(t => new FlavourTagDto(t.Flavour, t.Polarity)).ToList(), b.BrewedAt);
}

public sealed record CreateBrewRequest(Guid BeanId, BrewParamsDto Params, int DurationMs, IReadOnlyList<int>? PourMarkersMs);

public sealed record RateBrewRequest(int? Rating, IReadOnlyList<string>? Defects);

public sealed record TagBrewRequest(IReadOnlyList<FlavourTagDto> Tags);

public sealed record VoiceParseRequest(string Transcript, BrewParamsDto Current);

public sealed record VoiceParseResponse(bool Applied, string Transcript, BrewParamsDto Params, IReadOnlyList<string> Changes, string Summary);

public enum Provenance { Extracted, Partial, Missing }

public sealed record ExtractedField(string? Value, Provenance Provenance);

public sealed record DeclaredNote(string Text, string? Category);

public sealed record LabelScanResponse(
    string ScanId,
    bool Extracted,
    string? Reason,
    ExtractedField Roaster,
    ExtractedField Bean,
    ExtractedField Origin,
    ExtractedField Process,
    ExtractedField RoastDate,
    ExtractedField Producer,
    ExtractedField Varietal,
    ExtractedField Altitude,
    ExtractedField RoastLevel,
    IReadOnlyList<DeclaredNote> DeclaredNotes);
