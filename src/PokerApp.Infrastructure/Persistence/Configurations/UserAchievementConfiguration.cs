using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class UserAchievementConfiguration : IEntityTypeConfiguration<UserAchievement>
{
    public void Configure(EntityTypeBuilder<UserAchievement> builder)
    {
        builder.HasKey(x => x.Id);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(x => x.AchievementKey).HasMaxLength(50).IsRequired();

        builder.HasIndex(x => new { x.UserId, x.AchievementKey })
            .IsUnique()
            .HasDatabaseName("IX_UserAchievements_UserId_Key");

        builder.HasIndex(x => x.UserId)
            .HasDatabaseName("IX_UserAchievements_UserId");

        builder.ToTable("UserAchievements");
    }
}
