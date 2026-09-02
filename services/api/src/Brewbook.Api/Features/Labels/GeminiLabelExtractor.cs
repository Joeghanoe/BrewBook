using System.Text.Json;
using System.Text.Json.Serialization;
using Brewbook.Api.Contracts;
using Brewbook.Api.Integrations.Gemini;

namespace Brewbook.Api.Features.Labels;

/// <summary>Reads a coffee-bag label photo with Gemini and maps it onto the confirm-bag ledger.</summary>
public sealed class GeminiLabelExtractor(GeminiClient gemini, ILogger<GeminiLabelExtractor> log) : ILabelExtractor
{
    private const string Instructions = """
        You read specialty-coffee bag labels. Extract only what is printed on the label; never invent a value.
        For every field give a value (or null) and a confidence: "extracted" when it is printed clearly,
        "partial" when you could read part of it or had to infer (e.g. only a month for the roast date),
        "missing" when it is not on the label.
        - "bean" is the coffee's name (farm, lot or blend name), not the roaster.
        - "origin" is region and country, e.g. "Huila, Colombia".
        - "roast_date" is ISO yyyy-mm-dd; if only month and year are printed, use the 1st with confidence "partial".
        - "weight" is the bag's net weight in grams, digits only ("250g" -> "250", "1kg" -> "1000").
        - "declared_notes" lists the tasting notes exactly as printed, one per entry, no prose.
        """;

    private static readonly object Schema = new
    {
        type = "OBJECT",
        properties = new Dictionary<string, object>
        {
            ["roaster"] = Field(), ["bean"] = Field(), ["origin"] = Field(), ["process"] = Field(), ["roast_date"] = Field(),
            ["producer"] = Field(), ["varietal"] = Field(), ["altitude"] = Field(), ["roast_level"] = Field(), ["weight"] = Field(),
            ["declared_notes"] = new { type = "ARRAY", items = new { type = "STRING" } },
        },
        required = new[] { "roaster", "bean", "origin", "process", "roast_date", "producer", "varietal", "altitude", "roast_level", "weight", "declared_notes" },
    };

    private static object Field() => new
    {
        type = "OBJECT",
        properties = new Dictionary<string, object>
        {
            ["value"] = new { type = "STRING", nullable = true },
            ["confidence"] = new { type = "STRING", @enum = new[] { "extracted", "partial", "missing" } },
        },
        required = new[] { "value", "confidence" },
    };

    public bool Configured => true;

    public async Task<LabelScanResponse> ExtractAsync(byte[] image, string mediaType, CancellationToken ct)
    {
        var scanId = Guid.NewGuid().ToString("N");
        try
        {
            var text = await gemini.GenerateAsync(Instructions, "Read this coffee bag label.", new GeminiClient.Media(image, mediaType), Schema, ct);
            if (text is null) return Unreadable(scanId, "The label could not be read — fill the bag in by hand.");
            return Map(scanId, text);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            log.LogError(ex, "Label extraction failed for scan {ScanId}", scanId);
            return Unreadable(scanId, "Label reading is unavailable right now — fill the bag in by hand.");
        }
    }

    /// <summary>Pure mapping from the model's JSON to the wire shape; tested without a network.</summary>
    public static LabelScanResponse Map(string scanId, string json)
    {
        var raw = JsonSerializer.Deserialize<RawLabel>(json, JsonOpts);
        if (raw is null) return Unreadable(scanId, "The label could not be read.");
        return new LabelScanResponse(
            scanId, true, null,
            Map(raw.Roaster), Map(raw.Bean), Map(raw.Origin), Map(raw.Process), Map(raw.RoastDate),
            Map(raw.Producer), Map(raw.Varietal), Map(raw.Altitude), Map(raw.RoastLevel), Map(raw.Weight),
            (raw.DeclaredNotes ?? []).Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n.Trim()).Distinct()
                .Select(n => new DeclaredNote(n, FlavourLexicon.Categorise(n))).ToList());
    }

    private static LabelScanResponse Unreadable(string scanId, string reason)
    {
        var m = new ExtractedField(null, Provenance.Missing);
        return new LabelScanResponse(scanId, false, reason, m, m, m, m, m, m, m, m, m, m, []);
    }

    private static ExtractedField Map(RawField? f)
    {
        if (f is null || string.IsNullOrWhiteSpace(f.Value)) return new ExtractedField(null, Provenance.Missing);
        return f.Confidence?.ToLowerInvariant() switch
        {
            "extracted" => new ExtractedField(f.Value.Trim(), Provenance.Extracted),
            "partial" => new ExtractedField(f.Value.Trim(), Provenance.Partial),
            _ => new ExtractedField(null, Provenance.Missing),
        };
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true,
    };

    private sealed record RawField(string? Value, string? Confidence);

    private sealed record RawLabel(
        RawField? Roaster, RawField? Bean, RawField? Origin, RawField? Process,
        [property: JsonPropertyName("roast_date")] RawField? RoastDate,
        RawField? Producer, RawField? Varietal, RawField? Altitude,
        [property: JsonPropertyName("roast_level")] RawField? RoastLevel, RawField? Weight,
        [property: JsonPropertyName("declared_notes")] List<string>? DeclaredNotes);
}
