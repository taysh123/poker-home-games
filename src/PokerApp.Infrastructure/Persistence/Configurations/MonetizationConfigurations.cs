using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class SubscriptionConfiguration : IEntityTypeConfiguration<Subscription>
{
    public void Configure(EntityTypeBuilder<Subscription> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Store).IsRequired().HasConversion<int>();
        builder.Property(s => s.Status).IsRequired().HasConversion<int>();
        builder.Property(s => s.ProductId).IsRequired().HasMaxLength(200);
        builder.Property(s => s.Plan).IsRequired().HasMaxLength(50);
        builder.Property(s => s.OriginalTransactionId).IsRequired().HasMaxLength(255);

        // One subscription row per store transaction.
        builder.HasIndex(s => new { s.Store, s.OriginalTransactionId })
            .IsUnique()
            .HasDatabaseName("IX_Subscriptions_Store_OriginalTransactionId");
        builder.HasIndex(s => s.UserId).HasDatabaseName("IX_Subscriptions_UserId");

        builder.HasOne<User>().WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.ToTable("Subscriptions");
    }
}

public class CreditLedgerEntryConfiguration : IEntityTypeConfiguration<CreditLedgerEntry>
{
    public void Configure(EntityTypeBuilder<CreditLedgerEntry> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Type).IsRequired().HasConversion<int>();
        builder.Property(e => e.PeriodKey).IsRequired().HasMaxLength(64);
        builder.Property(e => e.Reason).IsRequired().HasMaxLength(120);
        builder.Property(e => e.IdempotencyKey).IsRequired().HasMaxLength(200);
        builder.Property(e => e.SourceRef).HasMaxLength(200);

        // Idempotency at the DB level — a duplicate logical action cannot be inserted twice.
        builder.HasIndex(e => e.IdempotencyKey)
            .IsUnique()
            .HasDatabaseName("IX_CreditLedger_IdempotencyKey");
        builder.HasIndex(e => new { e.UserId, e.PeriodKey })
            .HasDatabaseName("IX_CreditLedger_UserId_PeriodKey");

        builder.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.ToTable("CreditLedgerEntries");
    }
}

public class CreditBalanceConfiguration : IEntityTypeConfiguration<CreditBalance>
{
    public void Configure(EntityTypeBuilder<CreditBalance> builder)
    {
        builder.HasKey(b => b.Id);
        builder.Property(b => b.PeriodKey).IsRequired().HasMaxLength(64);

        builder.HasIndex(b => new { b.UserId, b.PeriodKey })
            .IsUnique()
            .HasDatabaseName("IX_CreditBalances_UserId_PeriodKey");

        builder.HasOne<User>().WithMany().HasForeignKey(b => b.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.ToTable("CreditBalances");
    }
}

public class StoreWebhookEventConfiguration : IEntityTypeConfiguration<StoreWebhookEvent>
{
    public void Configure(EntityTypeBuilder<StoreWebhookEvent> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Store).IsRequired().HasConversion<int>();
        builder.Property(e => e.NotificationUuid).IsRequired().HasMaxLength(200);
        builder.Property(e => e.Type).IsRequired().HasMaxLength(80);

        builder.HasIndex(e => e.NotificationUuid)
            .IsUnique()
            .HasDatabaseName("IX_StoreWebhookEvents_NotificationUuid");
        builder.ToTable("StoreWebhookEvents");
    }
}
