namespace Brewbook.Api.Features;

/// <summary>
/// Capabilities that can be turned off wholesale, as opposed to the integrations that switch
/// themselves off when their key is missing. Off by default: a capability is enabled deliberately.
/// </summary>
public sealed class FeatureOptions
{
    public const string SectionName = "Features";

    /// <summary>
    /// Friends, invitations, shared recipes and the map's friends scope (§5). While this is off the
    /// API refuses every friends route and reports the whole surface as unavailable, so the client
    /// can leave it out rather than show a tab that cannot do anything.
    /// </summary>
    public bool Friends { get; set; }
}
