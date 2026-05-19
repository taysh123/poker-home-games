using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class SessionPlayerConfiguration : IEntityTypeConfiguration<SessionPlayer>
{
    public void Configure(EntityTypeBuilder<SessionPlayer> builder)
    {
        builder.HasKey(x => x.Id);

        builder.HasOne(x => x.Session)
            .WithMany(s => s.SessionPlayers)
            .HasForeignKey(x => x.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(x => x.GuestName)
            .HasMaxLength(50);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.SessionId, x.UserId })
            .IsUnique()
            .HasFilter("\"UserId\" IS NOT NULL")
            .HasDatabaseName("IX_SessionPlayers_SessionId_UserId");

        builder.HasIndex(x => new { x.SessionId, x.GuestName })
            .IsUnique()
            .HasFilter("\"GuestName\" IS NOT NULL")
            .HasDatabaseName("IX_SessionPlayers_SessionId_GuestName");

        builder.ToTable("SessionPlayers");
    }
}
