namespace Brewbook.Api.Domain;

/// <summary>
/// One roaster, shared across users: the bag's free-text roaster resolves to a row here by
/// normalised name. Location fields fill in lazily from Google Places and stay null when the
/// place could not be found. Ratings and flavour tags are never stored here; they stay per user.
/// </summary>
public sealed class Roaster
{
    public Guid Id { get; set; }
    /// <summary>Display form: the first spelling seen, or the place's display name once located.</summary>
    public required string Name { get; set; }
    /// <summary>Trimmed, casefolded, single-spaced. Unique.</summary>
    public required string NormalisedName { get; set; }

    public string? GooglePlaceId { get; set; }
    public string? FormattedAddress { get; set; }
    public double? Lat { get; set; }
    public double? Lng { get; set; }
    public string? Website { get; set; }
    /// <summary>When a lookup last completed, located or not. Null until the locator has been asked.</summary>
    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public bool Located => Lat is not null && Lng is not null;

    public ICollection<Bean> Beans { get; set; } = [];
}
