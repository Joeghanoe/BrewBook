using Brewbook.Api.Domain;

namespace Brewbook.Api.Features.Roasters;

/// <summary>How a person is named to someone else. A pin has room for a letter or two, and no more.</summary>
public static class PersonName
{
    /// <summary>The display name if they set one, otherwise the local part of their address.</summary>
    public static string Of(User u) => string.IsNullOrWhiteSpace(u.DisplayName) ? u.Email.Split('@')[0] : u.DisplayName.Trim();

    /// <summary>"Sam Okafor" → SO; "sam.okafor" → SO; "sam" → S. Upper case, at most two letters.</summary>
    public static string Initials(string name)
    {
        var words = name.Split([' ', '.', '_', '-'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(w => char.IsLetterOrDigit(w[0]))
            .ToList();
        if (words.Count == 0) return "?";
        var letters = words.Count == 1 ? words[0][..1] : string.Concat(words[0][0], words[^1][0]);
        return letters.ToUpperInvariant();
    }
}
