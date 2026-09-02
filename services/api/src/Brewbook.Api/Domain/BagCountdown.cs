namespace Brewbook.Api.Domain;

/// <summary>
/// A bag is a finite physical thing, and the label carries its weight (§7). Both numbers here are
/// estimates and read like estimates: a user who scoops straight from the bag will drift, and
/// being roughly right beats being silent. Pure over the bag, the doses brewed and the clock.
/// </summary>
public static class BagCountdown
{
    /// <summary>A bag more than this far off roast is old enough to ask about.</summary>
    public static readonly TimeSpan StaleAfter = TimeSpan.FromDays(365);

    /// <summary>Whole brews left at the current dose. Null without a label weight — no weight, no countdown.</summary>
    public static int? BrewsLeft(decimal? weightG, decimal dosedG, decimal nextDoseG)
    {
        if (weightG is not { } weight || nextDoseG <= 0) return null;
        var remaining = weight - dosedG;
        return remaining <= 0 ? 0 : (int)Math.Floor(remaining / nextDoseG);
    }

    /// <summary>
    /// Two triggers, both honest: the bag is empty, or it is over a year off roast. Never "you have
    /// not brewed this lately". Asked once per bag; the answer itself is always the user's.
    /// </summary>
    public static bool AskToArchive(Bean bean, int? brewsLeft, DateTimeOffset now) =>
        !bean.Archived
        && bean.ArchivePromptedAt is null
        && (brewsLeft == 0 || IsStale(bean.RoastDate, now));

    public static bool IsStale(DateOnly? roastDate, DateTimeOffset now) =>
        roastDate is { } d && now - new DateTimeOffset(d.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero) > StaleAfter;
}
