namespace Brewbook.Api.Integrations.GooglePlaces;

/// <summary>
/// Two Google Maps Platform keys with different restrictions. The server key calls Places API
/// (New) from the API and never leaves it; the browser key is handed to the SPA for the Maps
/// JavaScript API and is restricted to the app's HTTP referrer in Cloud Console. Either may be
/// unset: no server key means roasters stay unlocated, no browser key means the web shows a list.
/// </summary>
public sealed class GoogleMapsOptions
{
    public const string SectionName = "GoogleMaps";

    public string? ServerKey { get; set; }
    public string? BrowserKey { get; set; }
    public string PlacesEndpoint { get; set; } = "https://places.googleapis.com/v1";
    public int TimeoutSeconds { get; set; } = 10;

    public bool ServerConfigured => !string.IsNullOrWhiteSpace(ServerKey);
}
