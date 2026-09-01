using Brewbook.Api.Domain;

namespace Brewbook.Api.Auth;

/// <summary>Scoped per request. Populated by <see cref="ProxyIdentityMiddleware"/>; null on unauthenticated paths like /health.</summary>
public sealed class CurrentUser
{
    public User? User { get; internal set; }

    public User Required => User ?? throw new InvalidOperationException("No authenticated user on this request.");
    public Guid Id => Required.Id;
}
