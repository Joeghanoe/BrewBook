using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;

namespace Brewbook.Api.Features.Users;

public static class UsersEndpoints
{
    public static RouteGroupBuilder MapUsers(this RouteGroupBuilder api)
    {
        api.MapGet("/me", (CurrentUser me) =>
        {
            var u = me.Required;
            return Results.Ok(new MeResponse(u.Id, u.Email, u.DisplayName));
        });
        return api;
    }
}
