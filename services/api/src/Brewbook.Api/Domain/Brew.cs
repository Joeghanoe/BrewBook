namespace Brewbook.Api.Domain;

public sealed class Brew
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid BeanId { get; set; }
    public Bean? Bean { get; set; }

    /// <summary>Per-user sequence (the ticket's N°). Unique per user, never global.</summary>
    public int Number { get; set; }

    public decimal Grind { get; set; }
    public decimal DoseG { get; set; }
    public decimal YieldG { get; set; }
    public decimal TempC { get; set; }
    public int Blooms { get; set; }
    public int DurationMs { get; set; }
    public List<int> PourMarkersMs { get; set; } = [];

    /// <summary>0 means unrated.</summary>
    public int Rating { get; set; }
    public List<string> Defects { get; set; } = [];

    public DateTimeOffset BrewedAt { get; set; }

    public ICollection<FlavourTag> FlavourTags { get; set; } = [];
}
