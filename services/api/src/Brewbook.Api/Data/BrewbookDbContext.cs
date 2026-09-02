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
    public DbSet<Roaster> Roasters => Set<Roaster>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<FriendInvite> FriendInvites => Set<FriendInvite>();
    public DbSet<RoasterWish> RoasterWishes => Set<RoasterWish>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(320).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.DisplayName).HasMaxLength(200);
            // Rating publishes by default (§5), for the users who already exist as much as for new ones.
            e.Property(x => x.ShareRatedByDefault).HasDefaultValue(true);
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
            e.Property(x => x.WeightG).HasPrecision(7, 1);
            e.HasIndex(x => new { x.UserId, x.Archived });
            e.HasIndex(x => x.RoasterId);
            e.HasOne(x => x.User).WithMany(u => u.Beans).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            // A roaster row outlives any one bag; unlinking keeps the bag and its text roaster.
            e.HasOne(x => x.LinkedRoaster).WithMany(r => r.Beans).HasForeignKey(x => x.RoasterId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Roaster>(e =>
        {
            e.ToTable("roasters");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.NormalisedName).HasMaxLength(200).IsRequired();
            e.HasIndex(x => x.NormalisedName).IsUnique();
            e.Property(x => x.GooglePlaceId).HasMaxLength(300);
            e.Property(x => x.FormattedAddress).HasMaxLength(500);
            e.Property(x => x.Website).HasMaxLength(500);
            e.Ignore(x => x.Located);
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

        b.Entity<Friendship>(e =>
        {
            e.ToTable("friendships");
            // The ordered pair is the key, so a friendship cannot exist twice or in one direction only.
            e.HasKey(x => new { x.LowUserId, x.HighUserId });
            e.HasIndex(x => x.HighUserId);
            e.HasOne(x => x.LowUser).WithMany().HasForeignKey(x => x.LowUserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.HighUser).WithMany().HasForeignKey(x => x.HighUserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<FriendInvite>(e =>
        {
            e.ToTable("friend_invites");
            e.HasKey(x => x.Id);
            e.Property(x => x.Token).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.Token).IsUnique();
            e.Property(x => x.ToEmail).HasMaxLength(320);
            e.HasIndex(x => x.ToEmail);
            e.HasOne(x => x.FromUser).WithMany().HasForeignKey(x => x.FromUserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<RoasterWish>(e =>
        {
            e.ToTable("roaster_wishes");
            e.HasKey(x => new { x.UserId, x.RoasterId });
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Roaster).WithMany().HasForeignKey(x => x.RoasterId).OnDelete(DeleteBehavior.Cascade);
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
