using System.Text.RegularExpressions;

namespace Brewbook.Api.Features.Roasters;

/// <summary>How a bag's free-text roaster becomes the key of a shared roaster row.</summary>
public static partial class RoasterName
{
    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    /// <summary>Trim, casefold, collapse runs of whitespace. Null when nothing usable remains.</summary>
    public static string? Normalise(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var n = Whitespace().Replace(raw.Trim(), " ").ToLowerInvariant();
        return n.Length == 0 ? null : n;
    }

    /// <summary>The display form: trimmed and single-spaced, case kept as the user wrote it.</summary>
    public static string? Display(string? raw) => string.IsNullOrWhiteSpace(raw) ? null : Whitespace().Replace(raw.Trim(), " ");
}
