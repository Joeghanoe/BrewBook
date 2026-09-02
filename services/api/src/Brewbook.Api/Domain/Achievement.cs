namespace Brewbook.Api.Domain;

/// <summary>A passport stamp. One row per (user, catalogue key); never removed once earned.</summary>
public sealed class Achievement
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public required string Key { get; set; }
    public DateTimeOffset UnlockedAt { get; set; }
    /// <summary>The brew whose write earned the stamp, when there was one. Nulled if that brew is undone.</summary>
    public Guid? BrewId { get; set; }
    public Brew? Brew { get; set; }
}
