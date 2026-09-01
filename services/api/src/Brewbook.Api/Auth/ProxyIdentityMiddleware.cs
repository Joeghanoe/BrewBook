using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Brewbook.Api.Auth;

public sealed class ProxyIdentityMiddleware(RequestDelegate next, IOptions<ProxyIdentityOptions> options, ILogger<ProxyIdentityMiddleware> log)
{
    private readonly ProxyIdentityOptions _opt = options.Value;

    public async Task InvokeAsync(HttpContext ctx, BrewbookDbContext db, CurrentUser current, TimeProvider clock)
    {
        var email = ctx.Request.Headers[_opt.EmailHeader].FirstOrDefault()?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email) || !email.Contains('@'))
        {
            // Header names only: enough to see what the proxy actually forwards, never a value.
            log.LogWarning("Rejected request without proxy identity header {Header} on {Path}; headers present: {Names}",
                _opt.EmailHeader, ctx.Request.Path, string.Join(", ", ctx.Request.Headers.Keys.OrderBy(k => k)));
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await ctx.Response.WriteAsJsonAsync(new { type = "about:blank", title = "Unauthenticated", status = 401, detail = "Requests must arrive through the auth proxy." });
            return;
        }

        var displayName = ctx.Request.Headers[_opt.PreferredUsernameHeader].FirstOrDefault()
                          ?? ctx.Request.Headers[_opt.UserHeader].FirstOrDefault();

        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email, ctx.RequestAborted);
        if (user is null)
        {
            user = new User { Id = Guid.NewGuid(), Email = email, DisplayName = displayName, CreatedAt = clock.GetUtcNow() };
            db.Users.Add(user);
            try
            {
                await db.SaveChangesAsync(ctx.RequestAborted);
            }
            catch (DbUpdateException)
            {
                // Two first requests raced on the unique email index; the other one won.
                db.Entry(user).State = EntityState.Detached;
                user = await db.Users.SingleAsync(u => u.Email == email, ctx.RequestAborted);
            }
        }

        current.User = user;
        await next(ctx);
    }
}
