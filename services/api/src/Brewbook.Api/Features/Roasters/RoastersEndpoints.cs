using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Brewbook.Api.Features.Friends;
using Brewbook.Api.Integrations.GooglePlaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Brewbook.Api.Features.Roasters;

public static class RoastersEndpoints
{
    /// <summary>Locations fill in lazily on the list call. A personal log has a handful of roasters; this bounds one request's outbound calls.</summary>
    private const int MaxResolvesPerRequest = 8;

    /// <summary>Whose roasters the map is showing. One control, always visible, defaulting to the user's own (§4).</summary>
    public enum Scope { Mine, Friends, Both }

    public static RouteGroupBuilder MapRoasters(this RouteGroupBuilder api)
    {
        api.MapGet("/config", (IOptions<GoogleMapsOptions> maps) =>
            Results.Ok(new ConfigResponse(string.IsNullOrWhiteSpace(maps.Value.BrowserKey) ? null : maps.Value.BrowserKey)));

        var g = api.MapGroup("/roasters");

        g.MapGet("/", async (string? flavours, string? scope, CurrentUser me, BrewbookDbContext db, IRoasterLocator locator, TimeProvider clock, CancellationToken ct) =>
        {
            var wanted = RoasterStats.ParseFlavours(flavours);
            var view = ParseScope(scope);

            var friendIds = view is Scope.Mine ? [] : await FriendGraph.FriendIdsAsync(db, me.Id, ct);
            var mineIncluded = view is not Scope.Friends;

            // The user's own bags, whole; a friend's only through what they published. A friend who
            // rates nothing puts nothing on the map, because rating is what publishing is (§5).
            var myBags = mineIncluded
                ? await db.Beans.Include(b => b.LinkedRoaster).Where(b => b.UserId == me.Id && b.RoasterId != null).ToListAsync(ct)
                : [];
            var friendBags = friendIds.Count == 0
                ? []
                : await db.Beans.Include(b => b.LinkedRoaster).Where(b => friendIds.Contains(b.UserId) && b.RoasterId != null).ToListAsync(ct);

            var myBeanIds = myBags.Select(b => b.Id).ToList();
            var myBrews = myBeanIds.Count == 0
                ? []
                : await db.Brews.Include(b => b.FlavourTags).Where(b => myBeanIds.Contains(b.BeanId)).ToListAsync(ct);
            var friendBrews = friendIds.Count == 0
                ? []
                : await FriendGraph.SharedBrewsOf(db, friendIds).Include(b => b.FlavourTags).ToListAsync(ct);

            var wishes = await db.RoasterWishes.Include(w => w.Roaster).Where(w => w.UserId == me.Id).ToListAsync(ct);
            var wished = wishes.Select(w => w.RoasterId).ToHashSet();

            // Names for the pins. A friend's pin is visibly not the user's own (§4).
            var people = await db.Users.Where(u => u.Id == me.Id || friendIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);

            var byBean = friendBrews.Concat(myBrews).ToLookup(b => b.BeanId);
            var groups = new Dictionary<Guid, List<RoasterStats.Person>>();
            var roasters = new Dictionary<Guid, Roaster>();

            void AddPerson(Guid userId, bool isMe, IEnumerable<Bean> bags, bool sharedOnly)
            {
                foreach (var byRoaster in bags.GroupBy(b => b.LinkedRoaster!))
                {
                    var theirBags = byRoaster.ToList();
                    var theirBrews = theirBags.SelectMany(b => byBean[b.Id]).Where(b => b.UserId == userId).ToList();
                    // A friend earns a place on the map with a brew they stood behind, not with a bag on a shelf.
                    if (sharedOnly)
                    {
                        if (theirBrews.Count == 0) continue;
                        var withBrews = theirBrews.Select(b => b.BeanId).ToHashSet();
                        theirBags = theirBags.Where(b => withBrews.Contains(b.Id)).ToList();
                    }
                    roasters[byRoaster.Key.Id] = byRoaster.Key;
                    if (!groups.TryGetValue(byRoaster.Key.Id, out var list)) groups[byRoaster.Key.Id] = list = [];
                    var name = people.TryGetValue(userId, out var u) ? PersonName.Of(u) : "someone";
                    list.Add(new RoasterStats.Person(userId, name, isMe, theirBags, theirBrews));
                }
            }

            AddPerson(me.Id, true, myBags, sharedOnly: false);
            foreach (var friendId in friendIds)
                AddPerson(friendId, false, friendBags.Where(b => b.UserId == friendId), sharedOnly: true);

            // A place the user means to go belongs on the map whether or not anyone has drunk it yet.
            foreach (var w in wishes.Where(w => w.Roaster is not null)) roasters[w.RoasterId] = w.Roaster!;

            if (roasters.Count == 0) return Results.Ok(Array.Empty<RoasterResponse>());

            // First need: ask the locator for rows nobody has looked up yet, and remember the answer.
            var resolves = 0;
            foreach (var roaster in roasters.Values.Where(r => r.ResolvedAt is null))
            {
                if (!locator.Configured || resolves >= MaxResolvesPerRequest) break;
                resolves++;
                var hint = OriginHint(groups.TryGetValue(roaster.Id, out var ps) ? ps.SelectMany(p => p.Bags) : []);
                await RoasterLinker.ResolveAsync(roaster, roaster.Name, hint, locator, clock, ct);
            }
            if (resolves > 0) await db.SaveChangesAsync(ct);

            var rows = roasters.Values
                .Select(r => RoasterStats.Build(
                    new RoasterStats.Input(r, groups.GetValueOrDefault(r.Id, []), wished.Contains(r.Id)), wanted));
            // A wish has no voice to match on; the palate filter is about coffee that was drunk.
            if (wanted.Count > 0) rows = rows.Where(r => r.MatchCount > 0 || (r.Wished && r.Voices.Count == 0));
            var ordered = rows
                .OrderByDescending(r => r.MatchCount ?? 0)
                .ThenByDescending(r => r.Voices.Max(v => v.AvgRating) ?? -1)
                .ThenByDescending(r => r.Voices.Sum(v => v.Brews))
                .ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
            return Results.Ok(ordered);
        });

        // A friend's rated brews from one roaster: the numbers behind the opinion (§5).
        g.MapGet("/{id:guid}/recipes", async (Guid id, Guid userId, CurrentUser me, BrewbookDbContext db, CancellationToken ct) =>
        {
            if (userId == me.Id) return Results.ValidationProblem(new Dictionary<string, string[]> { ["userId"] = ["Your own brews are in your log."] });
            if (!await FriendGraph.AreFriendsAsync(db, me.Id, userId, ct)) return Results.NotFound();

            var them = await db.Users.SingleOrDefaultAsync(u => u.Id == userId, ct);
            if (them is null) return Results.NotFound();
            var name = PersonName.Of(them);

            var brews = await FriendGraph.SharedBrewsOf(db, [userId])
                .Include(b => b.FlavourTags).Include(b => b.Bean)
                .Where(b => b.Bean!.RoasterId == id)
                .OrderByDescending(b => b.Rating).ThenByDescending(b => b.Number)
                .ToListAsync(ct);

            return Results.Ok(brews.Select(b => new SharedBrewDto(
                b.Id, userId, name, b.Number, b.Bean!.Name, b.Bean.Origin, b.Bean.Process, b.Bean.DeclaredNotes,
                BrewParamsDto.From(BrewParams.From(b)), b.DurationMs, b.Rating,
                b.FlavourTags.OrderBy(t => t.Flavour).Select(t => new FlavourTagDto(t.Flavour, t.Polarity)).ToList(), b.BrewedAt)));
        });

        // Want to visit: the map's own bookmark, about the place rather than the beans (§4).
        g.MapPut("/{id:guid}/wish", async (Guid id, CurrentUser me, BrewbookDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            if (!await db.Roasters.AnyAsync(r => r.Id == id, ct)) return Results.NotFound();
            if (await db.RoasterWishes.AnyAsync(w => w.UserId == me.Id && w.RoasterId == id, ct)) return Results.NoContent();
            db.RoasterWishes.Add(new RoasterWish { UserId = me.Id, RoasterId = id, CreatedAt = clock.GetUtcNow() });
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        g.MapDelete("/{id:guid}/wish", async (Guid id, CurrentUser me, BrewbookDbContext db, CancellationToken ct) =>
        {
            var wish = await db.RoasterWishes.SingleOrDefaultAsync(w => w.UserId == me.Id && w.RoasterId == id, ct);
            if (wish is null) return Results.NoContent();
            db.RoasterWishes.Remove(wish);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        g.MapPost("/{id:guid}/relocate", async (Guid id, RelocateRoasterRequest? req, CurrentUser me, BrewbookDbContext db, IRoasterLocator locator, TimeProvider clock, CancellationToken ct) =>
        {
            if (!locator.Configured) return Results.Problem("Roaster lookup is not configured on this deployment.", statusCode: 503);

            // Shared row, but only someone who has logged this roaster or pinned it may move it.
            var bags = await db.Beans.Include(b => b.LinkedRoaster).Where(b => b.UserId == me.Id && b.RoasterId == id).ToListAsync(ct);
            var roaster = bags.FirstOrDefault()?.LinkedRoaster
                ?? (await db.RoasterWishes.Include(w => w.Roaster).SingleOrDefaultAsync(w => w.UserId == me.Id && w.RoasterId == id, ct))?.Roaster;
            if (roaster is null) return Results.NotFound();

            var query = string.IsNullOrWhiteSpace(req?.Query) ? roaster.Name : req.Query.Trim();
            if (query.Length > 200) query = query[..200];
            // A user-typed query is the whole intent; only the name-based retry gets the origin hint.
            var hint = string.IsNullOrWhiteSpace(req?.Query) ? OriginHint(bags) : null;

            var changed = await RoasterLinker.ResolveAsync(roaster, query, hint, locator, clock, ct);
            if (!changed) return Results.Problem("Roaster lookup is unavailable right now.", statusCode: 503);
            await db.SaveChangesAsync(ct);

            var beanIds = bags.Select(b => b.Id).ToList();
            var brews = await db.Brews.Include(b => b.FlavourTags).Where(b => beanIds.Contains(b.BeanId)).ToListAsync(ct);
            var wished = await db.RoasterWishes.AnyAsync(w => w.UserId == me.Id && w.RoasterId == id, ct);
            var people = bags.Count == 0
                ? Array.Empty<RoasterStats.Person>()
                : [new RoasterStats.Person(me.Id, PersonName.Of(me.Required), true, bags, brews)];
            return Results.Ok(RoasterStats.Build(new RoasterStats.Input(roaster, people, wished), []));
        });

        return api;
    }

    private static Scope ParseScope(string? s) => s?.ToLowerInvariant() switch
    {
        "friends" => Scope.Friends,
        "both" => Scope.Both,
        _ => Scope.Mine,
    };

    /// <summary>The country from "Huila, Colombia": the most common last segment across the roaster's bags, when there is one.</summary>
    public static string? OriginHint(IEnumerable<Bean> bags) => bags
        .Select(b => b.Origin?.Split(',').Last().Trim())
        .Where(c => !string.IsNullOrEmpty(c))
        .GroupBy(c => c!, StringComparer.OrdinalIgnoreCase)
        .OrderByDescending(gr => gr.Count())
        .Select(gr => gr.Key)
        .FirstOrDefault();
}
