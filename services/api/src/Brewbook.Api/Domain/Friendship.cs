namespace Brewbook.Api.Domain;

/// <summary>
/// A mutual friendship (§5). Stored once per pair with the two ids ordered, so there is no
/// one-way state to get out of step: either both people are friends or neither is. Created only
/// when an invitation is accepted; nobody appears on someone's map without having agreed to.
/// </summary>
public sealed class Friendship
{
    /// <summary>The lower of the two user ids. Ordering the pair makes the row unique per friendship.</summary>
    public Guid LowUserId { get; set; }
    public Guid HighUserId { get; set; }
    public User? LowUser { get; set; }
    public User? HighUser { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public static (Guid low, Guid high) Pair(Guid a, Guid b) => a.CompareTo(b) <= 0 ? (a, b) : (b, a);

    public Guid Other(Guid mine) => mine == LowUserId ? HighUserId : LowUserId;
}
