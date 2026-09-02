namespace Brewbook.Api.Integrations.GooglePlaces;

public enum LocateStatus
{
    /// <summary>A place matched; <see cref="LocateResult.Place"/> is set.</summary>
    Located,
    /// <summary>The provider answered and found nothing. Worth remembering so the same name is not retried on every request.</summary>
    NotFound,
    /// <summary>No provider configured, or the call failed. Not an answer; try again later.</summary>
    Unavailable,
}

public sealed record RoasterPlace(string PlaceId, string DisplayName, string? FormattedAddress, double Lat, double Lng, string? Website);

public sealed record LocateResult(LocateStatus Status, RoasterPlace? Place)
{
    public static readonly LocateResult Unavailable = new(LocateStatus.Unavailable, null);
    public static readonly LocateResult NotFound = new(LocateStatus.NotFound, null);
}

/// <summary>Turns a roaster's name into a place on the map. Never invents a location.</summary>
public interface IRoasterLocator
{
    bool Configured { get; }
    /// <param name="query">The roaster's name, or whatever the user typed to correct a wrong match.</param>
    /// <param name="hint">Optional context such as the bean's origin country; appended to the search text.</param>
    Task<LocateResult> LocateAsync(string query, string? hint, CancellationToken ct);
}

/// <summary>Used when no server key is set. Says so; every roaster stays "not located".</summary>
public sealed class UnconfiguredRoasterLocator : IRoasterLocator
{
    public bool Configured => false;
    public Task<LocateResult> LocateAsync(string query, string? hint, CancellationToken ct) => Task.FromResult(LocateResult.Unavailable);
}
