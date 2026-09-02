namespace Brewbook.Api.Features.Friends;

/// <summary>
/// Posts an invitation. Best-effort like every other outbound call here: an invitation is a row
/// and a token first, and the link works whether or not the mail goes out (§5).
/// </summary>
public interface IInviteMailer
{
    bool Configured { get; }

    /// <summary>True when the invitation was accepted for delivery. Never throws.</summary>
    Task<bool> SendAsync(string toEmail, string fromName, string token, CancellationToken ct);
}

/// <summary>Used when no mail provider is configured. The invitee sees the invitation when they next open Brewbook.</summary>
public sealed class UnconfiguredInviteMailer : IInviteMailer
{
    public bool Configured => false;

    public Task<bool> SendAsync(string toEmail, string fromName, string token, CancellationToken ct) => Task.FromResult(false);
}
