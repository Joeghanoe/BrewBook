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

/// <summary>
/// What the proxy forwards is an identifier, not necessarily a name. Google's OIDC has no
/// `preferred_username`, so oauth2-proxy falls back to the subject claim and `X-Forwarded-User`
/// arrives as a 21-digit number. A number is not a display name: rejecting it here lets the rest
/// of the app fall back to the address's local part rather than render an id at people.
/// </summary>
public static class ProxyIdentity
{
    public static string? CleanDisplayName(string? raw)
    {
        var name = raw?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > 200) return null;
        // A subject id, an address, or a bare uuid: all identifiers, none of them names.
        if (name.All(char.IsAsciiDigit)) return null;
        if (name.Contains('@')) return null;
        if (Guid.TryParse(name, out _)) return null;
        return name;
    }
}
