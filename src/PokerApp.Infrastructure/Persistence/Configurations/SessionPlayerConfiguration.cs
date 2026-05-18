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

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.SessionId, x.UserId })
            .IsUnique()
            .HasDatabaseName("IX_SessionPlayers_SessionId_UserId");

        builder.ToTable("SessionPlayers");
    }
}
