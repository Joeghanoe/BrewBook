using System.Text.Json;
using System.Text.Json.Serialization;
using Anthropic;
using Anthropic.Models.Messages;
using Brewbook.Api.Contracts;
using Microsoft.Extensions.Options;

namespace Brewbook.Api.Features.Labels;

/// <summary>Reads a coffee-bag label photo with Claude vision and maps it onto the confirm-bag ledger.</summary>
public sealed class AnthropicLabelExtractor(AnthropicClient client, IOptions<LabelExtractionOptions> options, ILogger<AnthropicLabelExtractor> log) : ILabelExtractor
{
    private const string Instructions = """
        You read specialty-coffee bag labels. Extract only what is printed on the label. Reply with one JSON object and nothing else:
        {"roaster":F,"bean":F,"origin":F,"process":F,"roast_date":F,"producer":F,"varietal":F,"altitude":F,"roast_level":F,"declared_notes":["..."]}
        where F is {"value":string|null,"confidence":"extracted"|"partial"|"missing"}.
        - "bean" is the coffee's name (farm, lot or blend name), not the roaster.
        - "origin" is region and country, e.g. "Huila, Colombia".
        - "roast_date" is ISO yyyy-mm-dd when a full date is printed; if only month/year, give yyyy-mm-01 with confidence "partial".
        - "partial" means you could read part of it or had to infer; "missing" means it is not on the label. Never invent a value.
        - "declared_notes" lists the tasting notes exactly as printed, one per entry, without prose.
        """;

    public async Task<LabelScanResponse> ExtractAsync(byte[] image, string mediaType, CancellationToken ct)
    {
        var scanId = Guid.NewGuid().ToString("N");
        try
        {
            var response = await client.Messages.Create(new MessageCreateParams
            {
                Model = options.Value.Model,
                MaxTokens = 2048,
                System = Instructions,
                Messages =
                [
                    new()
                    {
                        Role = Role.User,
                        Content = new List<ContentBlockParam>
                        {
                            new ImageBlockParam { Source = new Base64ImageSource { Data = Convert.ToBase64String(image), MediaType = mediaType } },
                            new TextBlockParam { Text = "Read this coffee bag label." },
                        },
                    },
                ],
            }, cancellationToken: ct);

            if (response.StopReason == "refusal")
                return Unreadable(scanId, "The label reader declined this image.");

            var text = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(b => b.Text));
            var json = ExtractJson(text);
            var raw = JsonSerializer.Deserialize<RawLabel>(json, JsonOpts);
            if (raw is null) return Unreadable(scanId, "The label could not be read.");

            return new LabelScanResponse(
                scanId, true, null,
                Map(raw.Roaster), Map(raw.Bean), Map(raw.Origin), Map(raw.Process), Map(raw.RoastDate),
                Map(raw.Producer), Map(raw.Varietal), Map(raw.Altitude), Map(raw.RoastLevel),
                (raw.DeclaredNotes ?? []).Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n.Trim())
                    .Select(n => new DeclaredNote(n, FlavourLexicon.Categorise(n))).ToList());
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            // No provider details in the response: the user sees an honest "unreadable", the log gets the cause.
            log.LogError(ex, "Label extraction failed for scan {ScanId}", scanId);
            return Unreadable(scanId, "Label reading is unavailable right now — fill the bag in by hand.");
        }
    }

    private static LabelScanResponse Unreadable(string scanId, string reason)
    {
        var m = new ExtractedField(null, Provenance.Missing);
        return new LabelScanResponse(scanId, false, reason, m, m, m, m, m, m, m, m, m, []);
    }

    private static ExtractedField Map(RawField? f)
    {
        if (f is null || string.IsNullOrWhiteSpace(f.Value)) return new ExtractedField(null, Provenance.Missing);
        var prov = f.Confidence?.ToLowerInvariant() switch
        {
            "extracted" => Provenance.Extracted,
            "partial" => Provenance.Partial,
            _ => Provenance.Missing,
        };
        return prov == Provenance.Missing ? new ExtractedField(null, Provenance.Missing) : new ExtractedField(f.Value.Trim(), prov);
    }

    private static string ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        return start >= 0 && end > start ? text[start..(end + 1)] : "{}";
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    private sealed record RawField(string? Value, string? Confidence);

    private sealed record RawLabel(
        RawField? Roaster, RawField? Bean, RawField? Origin, RawField? Process,
        [property: JsonPropertyName("roast_date")] RawField? RoastDate,
        RawField? Producer, RawField? Varietal, RawField? Altitude,
        [property: JsonPropertyName("roast_level")] RawField? RoastLevel,
        [property: JsonPropertyName("declared_notes")] List<string>? DeclaredNotes);
}
