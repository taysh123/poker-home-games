using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class CloudBackupConfiguration : IEntityTypeConfiguration<CloudBackup>
{
    public void Configure(EntityTypeBuilder<CloudBackup> builder)
    {
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Namespace).IsRequired().HasMaxLength(64);
        // Opaque blob — store as text (no length cap at the column; size is bounded in the handler).
        builder.Property(b => b.Payload).IsRequired().HasColumnType("text");
        builder.Property(b => b.Version).IsRequired();

        // One backup row per (user, namespace) — the upsert / concurrency target.
        builder.HasIndex(b => new { b.UserId, b.Namespace })
            .IsUnique()
            .HasDatabaseName("IX_CloudBackups_UserId_Namespace");

        builder.HasOne<User>().WithMany().HasForeignKey(b => b.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.ToTable("CloudBackups");
    }
}
