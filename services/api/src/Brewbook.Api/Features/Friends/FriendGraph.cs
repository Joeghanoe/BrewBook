using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Brewbook.Api.Features.Friends;

/// <summary>
/// Reads the friendship graph. Friendship is mutual and stored once per ordered pair, so there is
/// one question to ask: who is this user friends with (§5).
/// </summary>
public static class FriendGraph
{
    public static async Task<List<Guid>> FriendIdsAsync(BrewbookDbContext db, Guid userId, CancellationToken ct) =>
        await db.Friendships
            .Where(f => f.LowUserId == userId || f.HighUserId == userId)
            .Select(f => f.LowUserId == userId ? f.HighUserId : f.LowUserId)
            .ToListAsync(ct);

    public static Task<bool> AreFriendsAsync(BrewbookDbContext db, Guid a, Guid b, CancellationToken ct)
    {
        var (low, high) = Friendship.Pair(a, b);
        return db.Friendships.AnyAsync(f => f.LowUserId == low && f.HighUserId == high, ct);
    }

    /// <summary>
    /// The brews a friend has published. Rating something publishes it (§5); an unrated brew is
    /// never shared, and a brew marked private is withdrawn. Nothing else of theirs is readable.
    /// </summary>
    public static IQueryable<Brew> SharedBrewsOf(BrewbookDbContext db, IReadOnlyCollection<Guid> userIds) =>
        db.Brews.Where(b => userIds.Contains(b.UserId) && b.Rating > 0 && !b.IsPrivate);
}
