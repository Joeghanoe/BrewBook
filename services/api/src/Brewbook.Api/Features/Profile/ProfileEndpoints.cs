using Brewbook.Api.Auth;
using Brewbook.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Brewbook.Api.Features.Profile;

public static class ProfileEndpoints
{
    public static RouteGroupBuilder MapProfile(this RouteGroupBuilder api)
    {
        api.MapGet("/profile", async (CurrentUser me, BrewbookDbContext db, CancellationToken ct) =>
        {
            // One read per table; the fold happens in memory (see ProfileBuilder).
            var beans = await db.Beans.AsNoTracking().Where(b => b.UserId == me.Id).ToListAsync(ct);
            var brews = await db.Brews.AsNoTracking().Where(b => b.UserId == me.Id).ToListAsync(ct);
            var tags = await db.FlavourTags.AsNoTracking().Where(t => t.Brew!.UserId == me.Id).ToListAsync(ct);
            return Results.Ok(ProfileBuilder.Build(me.Required, beans, brews, tags));
        });
        return api;
    }
}
