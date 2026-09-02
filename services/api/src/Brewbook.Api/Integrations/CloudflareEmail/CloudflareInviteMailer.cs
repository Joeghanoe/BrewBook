using System.Net.Http.Headers;
using System.Net.Http.Json;
using Brewbook.Api.Features.Friends;
using Microsoft.Extensions.Options;

namespace Brewbook.Api.Integrations.CloudflareEmail;

/// <summary>
/// Sends one invitation through Cloudflare Email Sending. The whole surface is a single POST, so
/// there is no client wrapper under this — the mailer is the client.
/// </summary>
public sealed class CloudflareInviteMailer(HttpClient http, IOptions<CloudflareEmailOptions> options, ILogger<CloudflareInviteMailer> log)
    : IInviteMailer
{
    private readonly CloudflareEmailOptions _opt = options.Value;

    public bool Configured => _opt.Configured;

    public async Task<bool> SendAsync(string toEmail, string fromName, string token, CancellationToken ct)
    {
        var url = InviteMail.Url(_opt.PublicUrl!, token);
        var body = new
        {
            personalizations = new[] { new { to = new[] { new { email = toEmail } } } },
            from = new { email = _opt.From, name = _opt.FromName },
            subject = InviteMail.Subject(fromName),
            content = new[]
            {
                new { type = "text/plain", value = InviteMail.Text(fromName, url) },
                new { type = "text/html", value = InviteMail.Html(fromName, url) },
            },
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_opt.Endpoint.TrimEnd('/')}/accounts/{_opt.AccountId}/email/sending/send");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opt.ApiToken);
        req.Content = JsonContent.Create(body);

        try
        {
            using var res = await http.SendAsync(req, ct);
            if (res.IsSuccessStatusCode) return true;
            // The address is the user's to get right; log the status, never the recipient.
            log.LogWarning("Invitation mail refused with {Status}", (int)res.StatusCode);
            return false;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            log.LogWarning("Invitation mail timed out");
            return false;
        }
        catch (HttpRequestException ex)
        {
            log.LogWarning(ex, "Invitation mail could not be sent");
            return false;
        }
    }
}
