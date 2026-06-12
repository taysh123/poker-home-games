using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Username)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(u => u.Email)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(u => u.PasswordHash)
            .IsRequired();

        // Store as int — readable in raw SQL, immune to enum rename bugs
        builder.Property(u => u.AppRole)
            .IsRequired()
            .HasConversion<int>();

        builder.Property(u => u.CreatedAt)
            .IsRequired();

        builder.Property(u => u.UpdatedAt)
            .IsRequired();

        builder.Property(u => u.GoogleId)
            .HasMaxLength(255);

        builder.Property(u => u.AvatarEmoji)
            .HasMaxLength(16);

        // Hex color, e.g. #C9A84C
        builder.Property(u => u.AvatarColor)
            .HasMaxLength(7);

        builder.HasIndex(u => u.Email)
            .IsUnique()
            .HasDatabaseName("IX_Users_Email");

        builder.HasIndex(u => u.Username)
            .IsUnique()
            .HasDatabaseName("IX_Users_Username");

        builder.HasIndex(u => u.GoogleId)
            .HasDatabaseName("IX_Users_GoogleId");

        builder.ToTable("Users");
    }
}
