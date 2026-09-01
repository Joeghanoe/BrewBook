using System.Text.Json;
using Brewbook.Api.Contracts;

namespace Brewbook.Api.Features.Voice;

public static class VoiceEndpoints
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private static VoiceParseResponse Parse(string transcript, BrewParamsDto current)
    {
        var r = VoiceCommandParser.Parse(transcript, current.ToDomain());
        return new VoiceParseResponse(r.Applied, transcript, BrewParamsDto.From(r.Params), r.Changes, r.Summary);
    }

    /// <summary>Browsers send "audio/webm;codecs=opus"; Gemini wants the bare type.</summary>
    private static string NormaliseMime(string? contentType)
    {
        var t = (contentType ?? "audio/webm").Split(';')[0].Trim().ToLowerInvariant();
        return t.StartsWith("audio/") || t.StartsWith("video/") ? t : "audio/webm";
    }

    public static RouteGroupBuilder MapVoice(this RouteGroupBuilder api)
    {
        // Speech-to-text runs in the browser (Web Speech API). The server owns the parse so the
        // interpretation is deterministic, testable, and identical across devices.
        api.MapPost("/voice/parse", (VoiceParseRequest req) =>
        {
            var transcript = req.Transcript?.Trim() ?? "";
            if (transcript.Length == 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["transcript"] = ["Nothing was heard."] });
            if (transcript.Length > 500) transcript = transcript[..500];

            return Results.Ok(Parse(transcript, req.Current));
        });

        // Audio clip in, applied delta out. Transcription runs server-side (Gemini) when configured; the
        // client falls back to the browser's recogniser and /voice/parse when it is not.
        api.MapPost("/voice/transcribe", async (HttpRequest http, ISpeechTranscriber speech, CancellationToken ct) =>
        {
            if (!speech.Configured) return Results.Problem("Speech transcription is not configured on this deployment.", statusCode: 503);
            if (!http.HasFormContentType) return Results.Problem("Expected multipart/form-data with an 'audio' file and 'current' JSON.", statusCode: 415);
            var form = await http.ReadFormAsync(ct);
            var file = form.Files.GetFile("audio");
            if (file is null || file.Length == 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["audio"] = ["An audio clip is required."] });
            if (file.Length > 5 * 1024 * 1024) return Results.Problem("Audio clip exceeds 5 MB.", statusCode: 413);
            BrewParamsDto? current;
            try { current = JsonSerializer.Deserialize<BrewParamsDto>(form["current"].ToString(), JsonOpts); }
            catch (JsonException) { current = null; }
            if (current is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["current"] = ["Current ticket params are required."] });

            await using var stream = file.OpenReadStream();
            var bytes = new byte[file.Length];
            await stream.ReadExactlyAsync(bytes, ct);
            var transcript = await speech.TranscribeAsync(bytes, NormaliseMime(file.ContentType), ct);
            if (transcript is null)
                return Results.Ok(new VoiceParseResponse(false, "", current, [], "nothing was heard"));
            return Results.Ok(Parse(transcript.Length > 500 ? transcript[..500] : transcript, current));
        }).DisableAntiforgery();

        return api;
    }
}
