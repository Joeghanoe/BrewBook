using Brewbook.Api.Integrations.Gemini;

namespace Brewbook.Api.Features.Voice;

public interface ISpeechTranscriber
{
    bool Configured { get; }
    /// <summary>Transcript of the clip, or null when nothing could be transcribed.</summary>
    Task<string?> TranscribeAsync(byte[] audio, string mimeType, CancellationToken ct);
}

public sealed class UnconfiguredSpeechTranscriber : ISpeechTranscriber
{
    public bool Configured => false;
    public Task<string?> TranscribeAsync(byte[] audio, string mimeType, CancellationToken ct) => Task.FromResult<string?>(null);
}

/// <summary>Gemini listens to the clip and returns the words. The parse stays deterministic and local.</summary>
public sealed class GeminiSpeechTranscriber(GeminiClient gemini, ILogger<GeminiSpeechTranscriber> log) : ISpeechTranscriber
{
    private const string Instructions = """
        Transcribe the speech in this audio clip verbatim. It is a coffee brewer adjusting a recipe and may mention
        grind, dose, yield, water temperature in degrees, blooms, grams, clicks, finer or coarser.
        Reply with the transcript only: no quotes, no commentary. If there is no intelligible speech, reply with an empty string.
        """;

    public bool Configured => true;

    public async Task<string?> TranscribeAsync(byte[] audio, string mimeType, CancellationToken ct)
    {
        try
        {
            var text = await gemini.GenerateAsync(Instructions, "Transcribe the clip.", new GeminiClient.Media(audio, mimeType), null, ct);
            text = text?.Trim().Trim('"');
            return string.IsNullOrWhiteSpace(text) ? null : text;
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            log.LogError(ex, "Speech transcription failed");
            return null;
        }
    }
}
