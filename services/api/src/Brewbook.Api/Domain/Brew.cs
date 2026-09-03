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

    public BrewMethod Method { get; set; }
    public decimal Grind { get; set; }
    public decimal DoseG { get; set; }
    public decimal YieldG { get; set; }
    public decimal TempC { get; set; }
    /// <summary>Filter only; 0 for other methods.</summary>
    public int Blooms { get; set; }
    /// <summary>Espresso only; null where the method has no pre-infusion.</summary>
    public int? PreInfusionS { get; set; }
    /// <summary>The recipe's planned time. <see cref="DurationMs"/> is what actually happened.</summary>
    public int TargetMs { get; set; }
    /// <summary>Measured brew time; 0 means the brew was logged without one and is still untimed.</summary>
    public int DurationMs { get; set; }
    /// <summary>Step times only, kept in sync with <see cref="Steps"/> for readers that predate labels.</summary>
    public List<int> PourMarkersMs { get; set; } = [];
    /// <summary>Labelled moments in the brew, ordered by time.</summary>
    public List<BrewStep> Steps { get; set; } = [];

    /// <summary>Steps own the truth; the marker list is derived from them on every write.</summary>
    public void SetSteps(IEnumerable<BrewStep> steps)
    {
        Steps = steps.OrderBy(x => x.AtMs).ToList();
        PourMarkersMs = Steps.Select(x => x.AtMs).ToList();
    }

    /// <summary>0 means unrated.</summary>
    public int Rating { get; set; }
    /// <summary>
    /// Kept out of friends' view. Rating something publishes it (§5); this is the per-brew way
    /// back. Unrated brews are never shared whatever this says — there is nothing to stand behind.
    /// </summary>
    public bool IsPrivate { get; set; }
    public List<string> Defects { get; set; } = [];

    public DateTimeOffset BrewedAt { get; set; }

    public ICollection<FlavourTag> FlavourTags { get; set; } = [];
}
