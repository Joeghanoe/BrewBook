using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Brewbook.Api.Features.Achievements;

/// <summary>Stamps the passport. Runs after any write that can change the facts; safe to run any number of times.</summary>
public sealed class AchievementService(BrewbookDbContext db, TimeProvider clock)
{
    /// <summary>Unlocks whatever the user's current brews, tags and beans earn. Returns the keys unlocked by this call.</summary>
    public async Task<IReadOnlyList<string>> EvaluateAsync(Guid userId, Guid? brewId, CancellationToken ct)
    {
        var facts = await LoadFactsAsync(userId, ct);
        var held = await db.Achievements.Where(a => a.UserId == userId).Select(a => a.Key).ToListAsync(ct);
        var have = held.ToHashSet(StringComparer.Ordinal);
        var now = clock.GetUtcNow();
        var added = new List<Achievement>();
        foreach (var rule in AchievementCatalogue.All)
        {
            if (have.Contains(rule.Key) || !rule.Evaluate(facts).Unlocked) continue;
            added.Add(new Achievement { UserId = userId, Key = rule.Key, UnlockedAt = now, BrewId = brewId });
        }
        if (added.Count == 0) return [];

        db.Achievements.AddRange(added);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Two writes from the same user raced on the same stamp. The other request holds the row,
            // so the stamp exists either way; this request just does not get to announce it.
            foreach (var a in added) db.Entry(a).State = EntityState.Detached;
            return [];
        }
        return added.Select(a => a.Key).ToList();
    }

    public async Task<AchievementFacts> LoadFactsAsync(Guid userId, CancellationToken ct)
    {
        var brews = await db.Brews.Where(b => b.UserId == userId).Select(b => new BrewFact(b.Id, b.BrewedAt)).ToListAsync(ct);
        var tags = await db.FlavourTags.Where(t => t.Brew!.UserId == userId)
            .Select(t => new TagFact(t.BrewId, t.Flavour, t.Polarity, t.Brew!.BrewedAt)).ToListAsync(ct);
        var beans = await db.Beans.Where(b => b.UserId == userId).Select(b => new BeanFact(b.Roaster)).ToListAsync(ct);
        return new AchievementFacts(brews, tags, beans);
    }
}
