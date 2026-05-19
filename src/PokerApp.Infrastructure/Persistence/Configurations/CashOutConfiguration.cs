using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class CashOutConfiguration : IEntityTypeConfiguration<CashOut>
{
    public void Configure(EntityTypeBuilder<CashOut> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.SessionId)
            .IsRequired();

        builder.Property(c => c.UserId)
            .IsRequired(false);

        builder.Property(c => c.SessionPlayerId)
            .IsRequired(false);

        builder.Property(c => c.Amount)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(c => c.Timestamp)
            .IsRequired();

        builder.Property(c => c.CreatedAt)
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .IsRequired();

        builder.HasOne(c => c.User)
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.SessionPlayer)
            .WithMany()
            .HasForeignKey(c => c.SessionPlayerId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(c => new { c.SessionId, c.SessionPlayerId })
            .HasDatabaseName("IX_CashOuts_SessionId_SessionPlayerId");

        builder.ToTable("CashOuts");
    }
}
