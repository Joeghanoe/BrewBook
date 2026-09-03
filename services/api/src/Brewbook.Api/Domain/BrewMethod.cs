using System.Text.Json.Serialization;

namespace Brewbook.Api.Domain;

/// <summary>
/// How the coffee is extracted. Stored as a small integer; add values at the end, never renumber.
/// On the wire it is the lowercase name, wherever the type is serialised. Moka pot and immersion
/// are the next candidates and get their own defaults when they arrive.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<BrewMethod>))]
public enum BrewMethod
{
    [JsonStringEnumMemberName("filter")] Filter = 0,
    [JsonStringEnumMemberName("espresso")] Espresso = 1,
}
