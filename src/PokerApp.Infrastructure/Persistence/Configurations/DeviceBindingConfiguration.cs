using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class DeviceBindingConfiguration : IEntityTypeConfiguration<DeviceBinding>
{
    public void Configure(EntityTypeBuilder<DeviceBinding> builder)
    {
        builder.HasKey(b => b.Id);
        builder.Property(b => b.DeviceId).IsRequired().HasMaxLength(200);

        // One row per (account, device); fast lookup of accounts sharing a device.
        builder.HasIndex(b => new { b.UserId, b.DeviceId })
            .IsUnique()
            .HasDatabaseName("IX_DeviceBindings_UserId_DeviceId");
        builder.HasIndex(b => b.DeviceId).HasDatabaseName("IX_DeviceBindings_DeviceId");

        builder.HasOne<User>().WithMany().HasForeignKey(b => b.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.ToTable("DeviceBindings");
    }
}
