using System.Security.Cryptography;
using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Brewbook.Api.Features.Roasters;
using Microsoft.EntityFrameworkCore;

namespace Brewbook.Api.Features.Friends;

public static class FriendsEndpoints
{
    private static readonly TimeSpan InviteLifetime = TimeSpan.FromDays(30);

    public static RouteGroupBuilder MapFriends(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/friends");

        g.MapGet("/", async (CurrentUser me, BrewbookDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var now = clock.GetUtcNow();
            var pairs = await db.Friendships
                .Where(f => f.LowUserId == me.Id || f.HighUserId == me.Id)
                .Select(f => new { Other = f.LowUserId == me.Id ? f.HighUserId : f.LowUserId, f.CreatedAt })
                .ToListAsync(ct);
            var ids = pairs.Select(p => p.Other).ToList();
            var users = await db.Users.Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);

            // What each friendship is actually worth to the user: roasters they can see, brews they can read.
            var shared = await FriendGraph.SharedBrewsOf(db, ids)
                .Select(b => new { b.UserId, b.Bean!.RoasterId })
                .ToListAsync(ct);
            var byFriend = shared.ToLookup(x => x.UserId);

            var friends = pairs
                .Where(p => users.ContainsKey(p.Other))
                .Select(p =>
                {
                    var u = users[p.Other];
                    var name = PersonName.Of(u);
                    var theirs = byFriend[p.Other].ToList();
                    return new FriendDto(u.Id, name, PersonName.Initials(name), u.Email, p.CreatedAt,
                        theirs.Where(x => x.RoasterId is not null).Select(x => x.RoasterId).Distinct().Count(), theirs.Count);
                })
                .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var myName = PersonName.Of(me.Required);
            // Expiry is compared in memory: a user has a handful of open invitations, and not every
            // provider translates a DateTimeOffset comparison.
            var sent = (await db.FriendInvites.Where(i => i.FromUserId == me.Id && i.AcceptedAt == null).ToListAsync(ct))
                .Where(i => i.Open(now))
                .OrderByDescending(i => i.CreatedAt)
                .Select(i => new FriendInviteDto(i.Token, myName, i.ToEmail, i.CreatedAt, i.ExpiresAt))
                .ToList();

            var email = me.Required.Email.ToLowerInvariant();
            var received = (await db.FriendInvites.Include(i => i.FromUser)
                    .Where(i => i.ToEmail == email && i.FromUserId != me.Id && i.AcceptedAt == null)
                    .ToListAsync(ct))
                .Where(i => i.Open(now))
                .OrderByDescending(i => i.CreatedAt)
                .Select(i => new FriendInviteDto(i.Token, PersonName.Of(i.FromUser!), i.ToEmail, i.CreatedAt, i.ExpiresAt))
                .ToList();

            return Results.Ok(new FriendsResponse(friends, sent, received));
        });

        // A link, or a link addressed to someone. There is no search and nobody is discoverable:
        // the only way into someone's log is to be handed the key (§5).
        g.MapPost("/invites", async (CreateFriendInviteRequest? req, CurrentUser me, BrewbookDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var email = req?.Email?.Trim().ToLowerInvariant();
            if (email is { Length: > 0 })
            {
                if (email.Length > 320 || !email.Contains('@') || email.StartsWith('@') || email.EndsWith('@'))
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["email"] = ["That does not look like an email address."] });
                if (email == me.Required.Email.ToLowerInvariant())
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["email"] = ["That is your own address."] });
            }
            else email = null;

            var now = clock.GetUtcNow();
            var invite = new FriendInvite
            {
                Id = Guid.NewGuid(),
                FromUserId = me.Id,
                Token = NewToken(),
                ToEmail = email,
                CreatedAt = now,
                ExpiresAt = now + InviteLifetime,
            };
            db.FriendInvites.Add(invite);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new FriendInviteDto(invite.Token, PersonName.Of(me.Required), invite.ToEmail, invite.CreatedAt, invite.ExpiresAt));
        });

        // Reading an invitation is all an invitee can do before accepting: no roasters, no recipes, no preview.
        g.MapGet("/invites/{token}", async (string token, CurrentUser me, BrewbookDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var invite = await db.FriendInvites.Include(i => i.FromUser).SingleOrDefaultAsync(i => i.Token == token, ct);
            if (invite is null) return Results.NotFound();
            if (!invite.Open(clock.GetUtcNow()))
                return Results.Problem("This invitation has already been used or has expired.", statusCode: 410);
            return Results.Ok(new FriendInviteDto(invite.Token, PersonName.Of(invite.FromUser!), invite.ToEmail, invite.CreatedAt, invite.ExpiresAt));
        });

        g.MapDelete("/invites/{token}", async (string token, CurrentUser me, BrewbookDbContext db, CancellationToken ct) =>
        {
            var invite = await db.FriendInvites.SingleOrDefaultAsync(i => i.Token == token && i.FromUserId == me.Id, ct);
            if (invite is null) return Results.NotFound();
            db.FriendInvites.Remove(invite);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // Accepting is what makes a friendship, and it makes it in both directions at once (§12).
        g.MapPost("/invites/{token}/accept", async (string token, CurrentUser me, BrewbookDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var now = clock.GetUtcNow();
            var invite = await db.FriendInvites.Include(i => i.FromUser).SingleOrDefaultAsync(i => i.Token == token, ct);
            if (invite is null) return Results.NotFound();
            if (!invite.Open(now)) return Results.Problem("This invitation has already been used or has expired.", statusCode: 410);
            if (invite.FromUserId == me.Id) return Results.Problem("That is your own invitation.", statusCode: 409);
            if (invite.ToEmail is { } addressed && !string.Equals(addressed, me.Required.Email, StringComparison.OrdinalIgnoreCase))
                return Results.Problem("This invitation was sent to a different address.", statusCode: 403);

            var (low, high) = Friendship.Pair(invite.FromUserId, me.Id);
            if (!await db.Friendships.AnyAsync(f => f.LowUserId == low && f.HighUserId == high, ct))
                db.Friendships.Add(new Friendship { LowUserId = low, HighUserId = high, CreatedAt = now });
            invite.AcceptedAt = now;
            invite.AcceptedByUserId = me.Id;
            await db.SaveChangesAsync(ct);

            var them = invite.FromUser!;
            var name = PersonName.Of(them);
            return Results.Ok(new FriendDto(them.Id, name, PersonName.Initials(name), them.Email, now, 0, 0));
        });

        return api;
    }

    /// <summary>URL-safe and unguessable: the token is the whole key to an invitation.</summary>
    private static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(24))
        .Replace('+', '-').Replace('/', '_').TrimEnd('=');
}
