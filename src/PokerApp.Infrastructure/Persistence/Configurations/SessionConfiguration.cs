using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class SessionConfiguration : IEntityTypeConfiguration<Session>
{
    public void Configure(EntityTypeBuilder<Session> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(s => s.GroupId)
            .IsRequired();

        builder.Property(s => s.SmallBlind)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(s => s.BigBlind)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(s => s.Status)
            .IsRequired()
            .HasConversion<int>();

        builder.Property(s => s.CreatedAt)
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .IsRequired();

        // BuyIns and CashOuts cascade — no orphan records without a session
        builder.HasMany(s => s.BuyIns)
            .WithOne(b => b.Session)
            .HasForeignKey(b => b.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(s => s.CashOuts)
            .WithOne(c => c.Session)
            .HasForeignKey(c => c.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(s => s.Settlements)
            .WithOne(st => st.Session)
            .HasForeignKey(st => st.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Lookup patterns: by group, by status, and combined
        builder.HasIndex(s => s.GroupId)
            .HasDatabaseName("IX_Sessions_GroupId");

        builder.HasIndex(s => s.Status)
            .HasDatabaseName("IX_Sessions_Status");

        builder.HasIndex(s => new { s.GroupId, s.Status })
            .HasDatabaseName("IX_Sessions_GroupId_Status");

        builder.ToTable("Sessions");
    }
}
