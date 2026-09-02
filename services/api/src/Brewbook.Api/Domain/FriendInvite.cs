namespace Brewbook.Api.Domain;

/// <summary>
/// One invitation to be friends (§5): a link the sender passes on, optionally addressed to an
/// email. There is no directory and nobody is discoverable; the token is the whole key. Until it
/// is accepted the invitee sees the invitation and nothing else — no roasters, no recipes.
/// </summary>
public sealed class FriendInvite
{
    public Guid Id { get; set; }
    public Guid FromUserId { get; set; }
    public User? FromUser { get; set; }

    /// <summary>URL-safe secret. The only way to find this invitation.</summary>
    public required string Token { get; set; }
    /// <summary>Casefolded address when the invitation names one; null for a plain link.</summary>
    public string? ToEmail { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public Guid? AcceptedByUserId { get; set; }

    public bool Open(DateTimeOffset now) => AcceptedAt is null && ExpiresAt > now;
}
