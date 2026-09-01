namespace Brewbook.Api.Domain;

public sealed class User
{
    public Guid Id { get; set; }
    public required string Email { get; set; }
    public string? DisplayName { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    /// <summary>When the first-sign-in guide was finished or skipped. Null until then; stamped once.</summary>
    public DateTimeOffset? OnboardedAt { get; set; }

    public ICollection<Bean> Beans { get; set; } = [];
    public ICollection<Brew> Brews { get; set; } = [];
}
