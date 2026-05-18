using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class BuyInConfiguration : IEntityTypeConfiguration<BuyIn>
{
    public void Configure(EntityTypeBuilder<BuyIn> builder)
    {
        builder.HasKey(b => b.Id);

        builder.Property(b => b.SessionId)
            .IsRequired();

        builder.Property(b => b.UserId)
            .IsRequired();

        builder.Property(b => b.Amount)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(b => b.Timestamp)
            .IsRequired();

        builder.Property(b => b.CreatedAt)
            .IsRequired();

        builder.Property(b => b.UpdatedAt)
            .IsRequired();

        // UserId FK: restrict so a user with buy-ins can't be silently deleted
        builder.HasOne(b => b.User)
            .WithMany()
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Composite: all buy-ins per user per session (running total queries)
        builder.HasIndex(b => new { b.SessionId, b.UserId })
            .HasDatabaseName("IX_BuyIns_SessionId_UserId");

        builder.ToTable("BuyIns");
    }
}
