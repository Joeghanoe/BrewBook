using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Brewbook.Api.Integrations.GooglePlaces;
using Microsoft.EntityFrameworkCore;

namespace Brewbook.Api.Features.Roasters;

/// <summary>Links bags to roaster rows by normalised name, and fills a row's location on first need.</summary>
public static class RoasterLinker
{
    /// <summary>The roaster row for this text, created if new. Null when the text is empty. Does not save.</summary>
    public static async Task<Roaster?> FindOrCreateAsync(BrewbookDbContext db, string? roasterText, TimeProvider clock, CancellationToken ct)
    {
        var key = RoasterName.Normalise(roasterText);
        if (key is null) return null;
        var existing = db.Roasters.Local.FirstOrDefault(r => r.NormalisedName == key)
                       ?? await db.Roasters.SingleOrDefaultAsync(r => r.NormalisedName == key, ct);
        if (existing is not null) return existing;
        var row = new Roaster { Id = Guid.NewGuid(), Name = RoasterName.Display(roasterText)!, NormalisedName = key, CreatedAt = clock.GetUtcNow() };
        db.Roasters.Add(row);
        return row;
    }

    /// <summary>
    /// Link and save, surviving the race where two requests create the same roaster at once: the
    /// unique index rejects the loser, which then adopts the winner's row.
    /// </summary>
    public static async Task LinkAndSaveAsync(BrewbookDbContext db, Bean bean, TimeProvider clock, CancellationToken ct)
    {
        var roaster = await FindOrCreateAsync(db, bean.Roaster, clock, ct);
        bean.RoasterId = roaster?.Id;
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (roaster is not null && db.Entry(roaster).State == EntityState.Added)
        {
            db.Entry(roaster).State = EntityState.Detached;
            var winner = await db.Roasters.SingleAsync(r => r.NormalisedName == roaster.NormalisedName, ct);
            bean.RoasterId = winner.Id;
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Once on startup: every bag with a roaster text and no link gets one. Idempotent; a second
    /// run finds nothing to do.
    /// </summary>
    public static async Task<int> BackfillAsync(BrewbookDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var unlinked = await db.Beans.Where(b => b.RoasterId == null && b.Roaster != null).ToListAsync(ct);
        var linked = 0;
        foreach (var bean in unlinked)
        {
            var roaster = await FindOrCreateAsync(db, bean.Roaster, clock, ct);
            if (roaster is null) continue;
            bean.RoasterId = roaster.Id;
            linked++;
        }
        if (linked > 0) await db.SaveChangesAsync(ct);
        return linked;
    }

    /// <summary>
    /// Ask the locator once and remember the answer on the row. An unavailable provider leaves
    /// the row untouched so the next request asks again; a definite "not found" is recorded so it
    /// does not. Returns true when the row changed. Does not save.
    /// </summary>
    public static async Task<bool> ResolveAsync(Roaster roaster, string query, string? hint, IRoasterLocator locator, TimeProvider clock, CancellationToken ct)
    {
        if (!locator.Configured) return false;
        var result = await locator.LocateAsync(query, hint, ct);
        if (result.Status == LocateStatus.Unavailable) return false;

        roaster.ResolvedAt = clock.GetUtcNow();
        if (result.Place is { } p)
        {
            roaster.GooglePlaceId = p.PlaceId;
            roaster.FormattedAddress = p.FormattedAddress;
            roaster.Lat = p.Lat;
            roaster.Lng = p.Lng;
            roaster.Website = p.Website;
        }
        else
        {
            roaster.GooglePlaceId = null;
            roaster.FormattedAddress = null;
            roaster.Lat = null;
            roaster.Lng = null;
            roaster.Website = null;
        }
        return true;
    }
}
