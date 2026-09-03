using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Brewbook.Api.Integrations.GooglePlaces;

/// <summary>Places API (New) Text Search: one query in, the best-ranked place out, or a short list for the user to choose from.</summary>
public sealed class GooglePlacesLocator(HttpClient http, IOptions<GoogleMapsOptions> options, ILogger<GooglePlacesLocator> log) : IRoasterLocator
{
    private readonly GoogleMapsOptions _opt = options.Value;

    // Billing is per field group; ask for exactly what the roasters row stores.
    private const string FieldMask = "places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri";

    /// <summary>How far around the drinker a roaster search leans. A bias, not a fence: Places still ranks the world.</summary>
    private const double BiasRadiusM = 50_000;

    public bool Configured => true;

    public async Task<LocateResult> LocateAsync(string query, double? lat, double? lng, CancellationToken ct)
    {
        // With a position, look near the drinker first and only then anywhere: a bias alone still
        // lets a famous namesake abroad outrank the roaster round the corner.
        if (Fence(lat, lng) is { } fence)
        {
            var near = await SearchTextAsync(new { textQuery = BuildQuery(query), pageSize = 1, regionCode = Region(_opt.RegionCode), locationRestriction = fence }, ct);
            if (near is null) return LocateResult.Unavailable;
            var found = Map(near);
            if (found.Status == LocateStatus.Located) return found;
        }
        var parsed = await SearchTextAsync(new { textQuery = BuildQuery(query), pageSize = 1, regionCode = Region(_opt.RegionCode), locationBias = Bias(lat, lng) }, ct);
        return parsed is null ? LocateResult.Unavailable : Map(parsed);
    }

    /// <summary>The rectangle Places accepts as a hard restriction: about the bias radius on each side of the position.</summary>
    public static object? Fence(double? lat, double? lng)
    {
        if (lat is not { } la || lng is not { } ln) return null;
        var dLat = BiasRadiusM / 111_320d;
        var dLng = dLat / Math.Max(0.2, Math.Cos(la * Math.PI / 180));
        return new { rectangle = new {
            low = new { latitude = Math.Max(-90, la - dLat), longitude = Math.Max(-180, ln - dLng) },
            high = new { latitude = Math.Min(90, la + dLat), longitude = Math.Min(180, ln + dLng) } } };
    }

    public async Task<SearchResult> SearchAsync(string query, double? lat, double? lng, int pageSize, CancellationToken ct)
    {
        var body = new
        {
            textQuery = BuildQuery(query),
            pageSize = Math.Clamp(pageSize, 1, 20),
            regionCode = Region(_opt.RegionCode),
            locationBias = Bias(lat, lng),
        };
        var parsed = await SearchTextAsync(body, ct);
        return parsed is null ? SearchResult.Unavailable : MapMany(parsed, lat, lng);
    }

    private static object? Bias(double? lat, double? lng)
        => lat is { } la && lng is { } ln ? new { circle = new { center = new { latitude = la, longitude = ln }, radius = BiasRadiusM } } : null;

    /// <summary>Null means the provider gave no answer: a failed call, a timeout, an error status. Callers treat that as "unavailable", never as "not found".</summary>
    private async Task<Response?> SearchTextAsync(object body, CancellationToken ct)
    {
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"{_opt.PlacesEndpoint.TrimEnd('/')}/places:searchText");
            req.Headers.Add("X-Goog-Api-Key", _opt.ServerKey);
            req.Headers.Add("X-Goog-FieldMask", FieldMask);
            // regionCode biases ranking towards the drinker's country without excluding anywhere else,
            // which is what a roaster search wants: mostly local, occasionally imported by post.
            req.Content = JsonContent.Create(body, options: Json);

            using var res = await http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                // Log status and the API's own message only; the request URL never carries the key, the header does.
                var err = await res.Content.ReadFromJsonAsync<ErrorEnvelope>(Json, ct);
                log.LogError("Places text search returned {Status}: {Message}", (int)res.StatusCode, err?.Error?.Message ?? res.ReasonPhrase);
                return null;
            }
            return await res.Content.ReadFromJsonAsync<Response>(Json, ct) ?? new Response([]);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            log.LogWarning("Places text search timed out after {Seconds}s", _opt.TimeoutSeconds);
            return null;
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException)
        {
            log.LogError(ex, "Places text search failed");
            return null;
        }
    }

    /// <summary>"Symple coffee roaster" — the word "roaster" steers the ranking away from cafés with the same name.</summary>
    public static string BuildQuery(string query)
    {
        var q = query.Trim();
        if (!q.Contains("roast", StringComparison.OrdinalIgnoreCase)) q += " coffee roaster";
        return q;
    }

    /// <summary>A CLDR region is two letters. Anything else is not one, and is dropped rather than sent.</summary>
    public static string? Region(string? raw)
    {
        var r = raw?.Trim();
        return r is { Length: 2 } && r.All(char.IsAsciiLetter) ? r.ToUpperInvariant() : null;
    }

    /// <summary>Pure mapping from the API's JSON shape; tested without a network.</summary>
    public static LocateResult Map(Response? parsed)
    {
        var p = parsed?.Places?.FirstOrDefault();
        if (p is null || p.Id is null || p.Location is null) return LocateResult.NotFound;
        var name = string.IsNullOrWhiteSpace(p.DisplayName?.Text) ? null : p.DisplayName.Text.Trim();
        if (name is null) return LocateResult.NotFound;
        return new LocateResult(LocateStatus.Located,
            new RoasterPlace(p.Id, name, p.FormattedAddress, p.Location.Latitude, p.Location.Longitude, p.WebsiteUri));
    }

    /// <summary>
    /// Every usable place, nearest to the drinker first when their position is known and in the
    /// provider's order otherwise. Pure; tested without a network.
    /// </summary>
    public static SearchResult MapMany(Response? parsed, double? lat, double? lng)
    {
        var list = new List<RoasterCandidate>();
        foreach (var p in parsed?.Places ?? [])
        {
            if (p.Id is null || p.Location is null) continue;
            var name = string.IsNullOrWhiteSpace(p.DisplayName?.Text) ? null : p.DisplayName.Text.Trim();
            if (name is null) continue;
            var km = lat is { } la && lng is { } ln ? HaversineKm(la, ln, p.Location.Latitude, p.Location.Longitude) : (double?)null;
            list.Add(new RoasterCandidate(p.Id, name, p.FormattedAddress, p.Location.Latitude, p.Location.Longitude, p.WebsiteUri, km));
        }
        if (lat is not null && lng is not null) list = list.OrderBy(c => c.DistanceKm).ToList();
        return new SearchResult(list.Count == 0 ? LocateStatus.NotFound : LocateStatus.Located, list);
    }

    /// <summary>Great-circle distance on a spherical earth. Close enough to sort a list of roasters by.</summary>
    public static double HaversineKm(double lat1, double lng1, double lat2, double lng2)
    {
        const double r = 6371.0;
        var dLat = Rad(lat2 - lat1);
        var dLng = Rad(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return 2 * r * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static double Rad(double deg) => deg * Math.PI / 180;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public sealed record Response(List<Place>? Places);
    public sealed record Place(string? Id, LocalizedText? DisplayName, string? FormattedAddress, LatLng? Location, string? WebsiteUri);
    public sealed record LocalizedText(string? Text, string? LanguageCode);
    public sealed record LatLng(double Latitude, double Longitude);
    private sealed record ErrorEnvelope(ErrorBody? Error);
    private sealed record ErrorBody(int Code, string? Message, string? Status);
}
