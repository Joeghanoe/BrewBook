namespace Brewbook.Api.Domain;

public sealed class Bean
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public required string Name { get; set; }
    public string? Roaster { get; set; }
    public string? Origin { get; set; }
    public string? Process { get; set; }
    public DateOnly? RoastDate { get; set; }
    public string? Producer { get; set; }
    public string? Varietal { get; set; }
    public string? Altitude { get; set; }
    public string? RoastLevel { get; set; }
    public List<string> DeclaredNotes { get; set; } = [];
    public bool Archived { get; set; }

    /// <summary>Stored when the bag was added by scanning its label. Null when entered by hand.</summary>
    public string? LabelScanId { get; set; }
    public DateTimeOffset? LabelScannedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Brew> Brews { get; set; } = [];
}
