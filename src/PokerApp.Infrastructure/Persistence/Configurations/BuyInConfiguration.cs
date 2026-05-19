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
            .IsRequired(false);

        builder.Property(b => b.SessionPlayerId)
            .IsRequired(false);

        builder.Property(b => b.Amount)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(b => b.Timestamp)
            .IsRequired();

        builder.Property(b => b.CreatedAt)
            .IsRequired();

        builder.Property(b => b.UpdatedAt)
            .IsRequired();

        builder.HasOne(b => b.User)
            .WithMany()
            .HasForeignKey(b => b.UserId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(b => b.SessionPlayer)
            .WithMany()
            .HasForeignKey(b => b.SessionPlayerId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(b => new { b.SessionId, b.SessionPlayerId })
            .HasDatabaseName("IX_BuyIns_SessionId_SessionPlayerId");

        builder.ToTable("BuyIns");
    }
}
