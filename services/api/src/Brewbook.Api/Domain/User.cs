namespace Brewbook.Api.Domain;

public sealed class User
{
    public Guid Id { get; set; }
    public required string Email { get; set; }
    public string? DisplayName { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Bean> Beans { get; set; } = [];
    public ICollection<Brew> Brews { get; set; } = [];
}
