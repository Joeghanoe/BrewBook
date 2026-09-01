namespace Brewbook.Api.Integrations.Gemini;

/// <summary>
/// Google Gemini through the Generative Language API. One key covers both label reading (image in)
/// and voice transcription (audio in). Unset key = both features report themselves unavailable.
/// </summary>
public sealed class GeminiOptions
{
    public const string SectionName = "Gemini";

    public string? ApiKey { get; set; }
    public string Model { get; set; } = "gemini-2.5-flash";
    public string Endpoint { get; set; } = "https://generativelanguage.googleapis.com/v1beta";
    public int TimeoutSeconds { get; set; } = 40;

    public bool Configured => !string.IsNullOrWhiteSpace(ApiKey);
}
