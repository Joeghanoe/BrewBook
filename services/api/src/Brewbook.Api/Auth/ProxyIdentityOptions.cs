namespace Brewbook.Api.Auth;

/// <summary>
/// The API trusts identity only from the headers oauth2-proxy forwards upstream with
/// `--pass-user-headers` (X-Forwarded-Email / -User / -Preferred-Username). Note that
/// `--set-xauthrequest` is a different thing: it puts X-Auth-Request-* on the RESPONSE to the
/// browser for nginx auth_request setups, and never reaches an upstream.
/// It must therefore never be reachable except through the proxy: no public domain on the api
/// service, private networking only. A request without the header is rejected, never anonymous.
/// </summary>
public sealed class ProxyIdentityOptions
{
    public const string SectionName = "ProxyIdentity";

    public string EmailHeader { get; set; } = "X-Forwarded-Email";
    public string UserHeader { get; set; } = "X-Forwarded-User";
    public string PreferredUsernameHeader { get; set; } = "X-Forwarded-Preferred-Username";
}
