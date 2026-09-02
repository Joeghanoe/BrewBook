namespace Brewbook.Api.Domain;

/// <summary>
/// "Want to visit" (§4): the map's own bookmark, about a place rather than a bag. It clears
/// itself once a bag from that roaster is in the library — the pin has done its job.
/// </summary>
public sealed class RoasterWish
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid RoasterId { get; set; }
    public Roaster? Roaster { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
