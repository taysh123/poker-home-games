using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class SettlementConfiguration : IEntityTypeConfiguration<Settlement>
{
    public void Configure(EntityTypeBuilder<Settlement> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.SessionId)
            .IsRequired();

        builder.Property(s => s.PayerUserId)
            .IsRequired();

        builder.Property(s => s.ReceiverUserId)
            .IsRequired();

        builder.Property(s => s.Amount)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(s => s.Status)
            .IsRequired()
            .HasConversion<int>();

        builder.Property(s => s.CreatedAt)
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .IsRequired();

        // Two separate FK relationships to Users — explicit names required to avoid ambiguity
        builder.HasOne(s => s.PayerUser)
            .WithMany()
            .HasForeignKey(s => s.PayerUserId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Settlements_Users_PayerUserId");

        builder.HasOne(s => s.ReceiverUser)
            .WithMany()
            .HasForeignKey(s => s.ReceiverUserId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Settlements_Users_ReceiverUserId");

        // Look up all settlements for a session, filter by status
        builder.HasIndex(s => new { s.SessionId, s.Status })
            .HasDatabaseName("IX_Settlements_SessionId_Status");

        // Look up all debts a specific user owes
        builder.HasIndex(s => s.PayerUserId)
            .HasDatabaseName("IX_Settlements_PayerUserId");

        // Look up all amounts a specific user is owed
        builder.HasIndex(s => s.ReceiverUserId)
            .HasDatabaseName("IX_Settlements_ReceiverUserId");

        builder.ToTable("Settlements");
    }
}
