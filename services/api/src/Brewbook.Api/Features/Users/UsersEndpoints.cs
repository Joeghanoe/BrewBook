using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Brewbook.Api.Features.Labels;
using Brewbook.Api.Features.Voice;

namespace Brewbook.Api.Features.Users;

public static class UsersEndpoints
{
    public static RouteGroupBuilder MapUsers(this RouteGroupBuilder api)
    {
        api.MapGet("/me", (CurrentUser me, ILabelExtractor labels, ISpeechTranscriber speech) =>
            Results.Ok(MeResponse.From(me.Required, Features(labels, speech))));

        api.MapPatch("/me", async (UpdateMeRequest req, CurrentUser me, BrewbookDbContext db, ILabelExtractor labels, ISpeechTranscriber speech, CancellationToken ct) =>
        {
            var u = me.Required;
            if (req.ShareRatedByDefault is { } share) u.ShareRatedByDefault = share;
            await db.SaveChangesAsync(ct);
            return Results.Ok(MeResponse.From(u, Features(labels, speech)));
        });

        // Stamps the first time only: a second call (another device, a retry) keeps the original time.
        api.MapPost("/me/onboarded", async (CurrentUser me, BrewbookDbContext db, TimeProvider clock, ILabelExtractor labels, ISpeechTranscriber speech, CancellationToken ct) =>
        {
            var u = me.Required;
            if (u.OnboardedAt is null)
            {
                u.OnboardedAt = clock.GetUtcNow();
                await db.SaveChangesAsync(ct);
            }
            return Results.Ok(MeResponse.From(u, Features(labels, speech)));
        });

        return api;
    }

    private static FeatureFlags Features(ILabelExtractor labels, ISpeechTranscriber speech) => new(labels.Configured, speech.Configured);
}
