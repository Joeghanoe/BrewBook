using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;
using Brewbook.Api.Features.Labels;
using Brewbook.Api.Features.Voice;

namespace Brewbook.Api.Features.Users;

public static class UsersEndpoints
{
    public static RouteGroupBuilder MapUsers(this RouteGroupBuilder api)
    {
        api.MapGet("/me", (CurrentUser me, ILabelExtractor labels, ISpeechTranscriber speech) =>
        {
            var u = me.Required;
            return Results.Ok(new MeResponse(u.Id, u.Email, u.DisplayName, new FeatureFlags(labels.Configured, speech.Configured)));
        });
        return api;
    }
}
