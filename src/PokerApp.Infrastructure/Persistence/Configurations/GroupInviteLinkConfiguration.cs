using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class GroupInviteLinkConfiguration : IEntityTypeConfiguration<GroupInviteLink>
{
    public void Configure(EntityTypeBuilder<GroupInviteLink> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Token)
            .HasMaxLength(64)
            .IsRequired();

        builder.HasIndex(t => t.Token)
            .IsUnique()
            .HasDatabaseName("IX_GroupInviteLinks_Token");

        builder.HasIndex(t => t.GroupId)
            .HasDatabaseName("IX_GroupInviteLinks_GroupId");

        builder.HasOne(t => t.Group)
            .WithMany()
            .HasForeignKey(t => t.GroupId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
