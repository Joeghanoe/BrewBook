namespace Brewbook.Api.Integrations.CloudflareEmail;

/// <summary>
/// Cloudflare Email Service (Email Sending). One token, one sender domain. Unset token = the app
/// still makes invitations, they just travel by link instead of by post.
/// </summary>
public sealed class CloudflareEmailOptions
{
    public const string SectionName = "Email";

    public string? AccountId { get; set; }
    public string? ApiToken { get; set; }
    /// <summary>Must be on a sender domain onboarded for Email Sending, or Cloudflare rejects the send.</summary>
    public string? From { get; set; }
    public string FromName { get; set; } = "Brewbook";
    /// <summary>Where an invitation link points. The API is only reachable through the proxy, so it cannot infer this.</summary>
    public string? PublicUrl { get; set; }
    public string Endpoint { get; set; } = "https://api.cloudflare.com/client/v4";
    public int TimeoutSeconds { get; set; } = 15;

    public bool Configured =>
        !string.IsNullOrWhiteSpace(AccountId) && !string.IsNullOrWhiteSpace(ApiToken)
        && !string.IsNullOrWhiteSpace(From) && !string.IsNullOrWhiteSpace(PublicUrl);
}
