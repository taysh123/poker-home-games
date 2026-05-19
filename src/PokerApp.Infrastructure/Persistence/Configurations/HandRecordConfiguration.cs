using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class HandRecordConfiguration : IEntityTypeConfiguration<HandRecord>
{
    public void Configure(EntityTypeBuilder<HandRecord> builder)
    {
        builder.HasKey(h => h.Id);

        builder.Property(h => h.WinnerName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(h => h.PotAmount)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(h => h.Note)
            .HasMaxLength(300);

        builder.Property(h => h.CreatedByUserId)
            .IsRequired();

        builder.HasIndex(h => h.SessionId)
            .HasDatabaseName("IX_HandRecords_SessionId");

        builder.ToTable("HandRecords");
    }
}
