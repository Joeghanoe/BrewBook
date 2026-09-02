using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Brewbook.Api.Features.Friends;
using Brewbook.Api.Features.Labels;
using Brewbook.Api.Features.Voice;
using Microsoft.Extensions.Options;

namespace Brewbook.Api.Features.Users;

public static class UsersEndpoints
{
    public static RouteGroupBuilder MapUsers(this RouteGroupBuilder api)
    {
        api.MapGet("/me", (CurrentUser me, Capabilities caps) =>
            Results.Ok(MeResponse.From(me.Required, caps.Flags)));

        api.MapPatch("/me", async (UpdateMeRequest req, CurrentUser me, BrewbookDbContext db, Capabilities caps, CancellationToken ct) =>
        {
            var u = me.Required;
            if (req.ShareRatedByDefault is { } share) u.ShareRatedByDefault = share;
            await db.SaveChangesAsync(ct);
            return Results.Ok(MeResponse.From(u, caps.Flags));
        });

        // Stamps the first time only: a second call (another device, a retry) keeps the original time.
        api.MapPost("/me/onboarded", async (CurrentUser me, BrewbookDbContext db, TimeProvider clock, Capabilities caps, CancellationToken ct) =>
        {
            var u = me.Required;
            if (u.OnboardedAt is null)
            {
                u.OnboardedAt = clock.GetUtcNow();
                await db.SaveChangesAsync(ct);
            }
            return Results.Ok(MeResponse.From(u, caps.Flags));
        });

        return api;
    }
}

/// <summary>
/// What this deployment can actually do, in one place: the integrations that switch themselves off
/// without a key, and the capabilities turned off by configuration. The client reads it once from
/// <c>/api/v1/me</c> and picks its path without probing.
/// </summary>
public sealed class Capabilities(ILabelExtractor labels, ISpeechTranscriber speech, IInviteMailer mailer, IOptions<FeatureOptions> features)
{
    public FeatureFlags Flags { get; } = new(
        labels.Configured,
        speech.Configured,
        features.Value.Friends,
        // Posting an invitation is meaningless without invitations to post.
        features.Value.Friends && mailer.Configured);
}
