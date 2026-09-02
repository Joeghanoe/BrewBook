using Brewbook.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Brewbook.Api.Data;

public sealed class BrewbookDbContext(DbContextOptions<BrewbookDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Bean> Beans => Set<Bean>();
    public DbSet<Brew> Brews => Set<Brew>();
    public DbSet<FlavourTag> FlavourTags => Set<FlavourTag>();
    public DbSet<Achievement> Achievements => Set<Achievement>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(320).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.DisplayName).HasMaxLength(200);
        });

        b.Entity<Bean>(e =>
        {
            e.ToTable("beans");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Roaster).HasMaxLength(200);
            e.Property(x => x.Origin).HasMaxLength(200);
            e.Property(x => x.Process).HasMaxLength(100);
            e.Property(x => x.Producer).HasMaxLength(200);
            e.Property(x => x.Varietal).HasMaxLength(200);
            e.Property(x => x.Altitude).HasMaxLength(100);
            e.Property(x => x.RoastLevel).HasMaxLength(100);
            e.Property(x => x.LabelScanId).HasMaxLength(100);
            e.HasIndex(x => new { x.UserId, x.Archived });
            e.HasOne(x => x.User).WithMany(u => u.Beans).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Brew>(e =>
        {
            e.ToTable("brews");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.Number }).IsUnique();
            e.HasIndex(x => new { x.BeanId, x.Number });
            e.Property(x => x.Grind).HasPrecision(5, 2);
            e.Property(x => x.DoseG).HasPrecision(6, 2);
            e.Property(x => x.YieldG).HasPrecision(7, 2);
            e.Property(x => x.TempC).HasPrecision(5, 2);
            e.HasOne(x => x.User).WithMany(u => u.Brews).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Bean).WithMany(bn => bn.Brews).HasForeignKey(x => x.BeanId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<FlavourTag>(e =>
        {
            e.ToTable("flavour_tags");
            e.HasKey(x => new { x.BrewId, x.Flavour });
            e.Property(x => x.Flavour).HasMaxLength(100);
            e.HasOne(x => x.Brew).WithMany(br => br.FlavourTags).HasForeignKey(x => x.BrewId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Achievement>(e =>
        {
            e.ToTable("achievements");
            e.HasKey(x => new { x.UserId, x.Key });
            e.Property(x => x.Key).HasMaxLength(64);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            // Undoing a brew keeps the stamp; it only loses the pointer.
            e.HasOne(x => x.Brew).WithMany().HasForeignKey(x => x.BrewId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
