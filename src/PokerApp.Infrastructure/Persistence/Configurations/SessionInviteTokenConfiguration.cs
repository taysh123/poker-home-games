using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class SessionInviteTokenConfiguration : IEntityTypeConfiguration<SessionInviteToken>
{
    public void Configure(EntityTypeBuilder<SessionInviteToken> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Token)
            .HasMaxLength(64)
            .IsRequired();

        builder.HasIndex(t => t.Token)
            .IsUnique()
            .HasDatabaseName("IX_SessionInviteTokens_Token");

        // Makes redemption atomic — the unique index above stops a duplicate token, not a
        // duplicate USE. Same mechanism as Session.Version; see SessionInviteToken.Version.
        builder.Property(t => t.Version)
            .IsConcurrencyToken();

        builder.HasOne(t => t.Session)
            .WithMany()
            .HasForeignKey(t => t.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
