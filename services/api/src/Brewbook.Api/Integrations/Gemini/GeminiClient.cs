using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Brewbook.Api.Integrations.Gemini;

/// <summary>Minimal generateContent client: one media part, one instruction, JSON back.</summary>
public sealed class GeminiClient(HttpClient http, IOptions<GeminiOptions> options, ILogger<GeminiClient> log)
{
    private readonly GeminiOptions _opt = options.Value;

    public sealed record Media(byte[] Bytes, string MimeType);

    /// <summary>Returns the model's text (JSON when a schema is given), or null when the model refused or the call failed.</summary>
    public async Task<string?> GenerateAsync(string systemInstruction, string prompt, Media media, object? responseSchema, CancellationToken ct)
    {
        var body = new
        {
            system_instruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new object[]
                    {
                        new { inline_data = new { mime_type = media.MimeType, data = Convert.ToBase64String(media.Bytes) } },
                        new { text = prompt },
                    },
                },
            },
            generationConfig = responseSchema is null
                ? new { temperature = 0.1 }
                : (object)new { temperature = 0.1, response_mime_type = "application/json", response_schema = responseSchema },
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_opt.Endpoint.TrimEnd('/')}/models/{_opt.Model}:generateContent");
        req.Headers.Add("x-goog-api-key", _opt.ApiKey);
        req.Content = JsonContent.Create(body, options: Json);

        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
        {
            // Body may echo request details; log status and the API's error message only.
            var err = await res.Content.ReadFromJsonAsync<ErrorEnvelope>(Json, ct);
            log.LogError("Gemini {Model} returned {Status}: {Message}", _opt.Model, (int)res.StatusCode, err?.Error?.Message ?? res.ReasonPhrase);
            return null;
        }

        var parsed = await res.Content.ReadFromJsonAsync<Response>(Json, ct);
        var candidate = parsed?.Candidates?.FirstOrDefault();
        if (candidate is null)
        {
            log.LogWarning("Gemini {Model} returned no candidate (block reason: {Reason})", _opt.Model, parsed?.PromptFeedback?.BlockReason ?? "none");
            return null;
        }
        if (candidate.FinishReason is not (null or "STOP" or "MAX_TOKENS"))
        {
            log.LogWarning("Gemini {Model} finished with {Reason}", _opt.Model, candidate.FinishReason);
            return null;
        }
        return string.Concat(candidate.Content?.Parts?.Select(p => p.Text) ?? []);
    }

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private sealed record Response(List<Candidate>? Candidates, PromptFeedback? PromptFeedback);
    private sealed record Candidate(Content? Content, string? FinishReason);
    private sealed record Content(List<Part>? Parts);
    private sealed record Part(string? Text);
    private sealed record PromptFeedback(string? BlockReason);
    private sealed record ErrorEnvelope(ErrorBody? Error);
    private sealed record ErrorBody(int Code, string? Message, string? Status);
}
