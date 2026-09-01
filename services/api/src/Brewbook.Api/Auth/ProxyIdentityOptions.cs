namespace Brewbook.Api.Auth;

/// <summary>
/// The API trusts identity only from headers set by oauth2-proxy (`--set-xauthrequest`).
/// It must therefore never be reachable except through the proxy: no public domain on the api
/// service, private networking only. A request without the header is rejected, never anonymous.
/// </summary>
public sealed class ProxyIdentityOptions
{
    public const string SectionName = "ProxyIdentity";

    public string EmailHeader { get; set; } = "X-Auth-Request-Email";
    public string UserHeader { get; set; } = "X-Auth-Request-User";
    public string PreferredUsernameHeader { get; set; } = "X-Auth-Request-Preferred-Username";
}
