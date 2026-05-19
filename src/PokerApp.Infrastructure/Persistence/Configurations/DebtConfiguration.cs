using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class DebtConfiguration : IEntityTypeConfiguration<Debt>
{
    public void Configure(EntityTypeBuilder<Debt> builder)
    {
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Amount)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(d => d.Reason)
            .HasMaxLength(200);

        builder.Property(d => d.Status)
            .IsRequired()
            .HasConversion<int>();

        builder.HasOne(d => d.FromUser)
            .WithMany()
            .HasForeignKey(d => d.FromUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(d => d.ToUser)
            .WithMany()
            .HasForeignKey(d => d.ToUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(d => d.GroupId)
            .HasDatabaseName("IX_Debts_GroupId");

        builder.HasIndex(d => new { d.FromUserId, d.Status })
            .HasDatabaseName("IX_Debts_FromUserId_Status");

        builder.HasIndex(d => new { d.ToUserId, d.Status })
            .HasDatabaseName("IX_Debts_ToUserId_Status");

        builder.ToTable("Debts");
    }
}
