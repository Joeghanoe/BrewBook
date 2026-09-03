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

/// <summary>One of several places a roaster name might mean. <c>DistanceKm</c> is from the drinker's own position when one was given.</summary>
public sealed record RoasterCandidate(string PlaceId, string DisplayName, string? FormattedAddress, double Lat, double Lng, string? Website, double? DistanceKm);

/// <summary>Candidates nearest first when a position was given, in the provider's order otherwise. Empty with <see cref="LocateStatus.NotFound"/> is an answer; empty with <see cref="LocateStatus.Unavailable"/> is not.</summary>
public sealed record SearchResult(LocateStatus Status, IReadOnlyList<RoasterCandidate> Candidates)
{
    public static readonly SearchResult Unavailable = new(LocateStatus.Unavailable, []);
}

/// <summary>Turns a roaster's name into a place on the map. Never invents a location.</summary>
public interface IRoasterLocator
{
    bool Configured { get; }
    /// <param name="query">The roaster's name, or whatever the user typed to correct a wrong match.</param>
    Task<LocateResult> LocateAsync(string query, CancellationToken ct);
    /// <summary>Several places the name might mean, for the user to choose from. A position biases the search and sorts the answer.</summary>
    Task<SearchResult> SearchAsync(string query, double? lat, double? lng, int pageSize, CancellationToken ct);
}

/// <summary>Used when no server key is set. Says so; every roaster stays "not located".</summary>
public sealed class UnconfiguredRoasterLocator : IRoasterLocator
{
    public bool Configured => false;
    public Task<LocateResult> LocateAsync(string query, CancellationToken ct) => Task.FromResult(LocateResult.Unavailable);
    public Task<SearchResult> SearchAsync(string query, double? lat, double? lng, int pageSize, CancellationToken ct) => Task.FromResult(SearchResult.Unavailable);
}
