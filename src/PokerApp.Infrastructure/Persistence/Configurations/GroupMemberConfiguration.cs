using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class GroupMemberConfiguration : IEntityTypeConfiguration<GroupMember>
{
    public void Configure(EntityTypeBuilder<GroupMember> builder)
    {
        builder.HasKey(gm => gm.Id);

        builder.Property(gm => gm.Role)
            .IsRequired()
            .HasConversion<int>();

        builder.Property(gm => gm.JoinedAt)
            .IsRequired();

        builder.Property(gm => gm.CreatedAt)
            .IsRequired();

        builder.Property(gm => gm.UpdatedAt)
            .IsRequired();

        builder.HasOne(gm => gm.User)
            .WithMany(u => u.GroupMemberships)
            .HasForeignKey(gm => gm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Unique: a user can appear in a group exactly once
        builder.HasIndex(gm => new { gm.GroupId, gm.UserId })
            .IsUnique()
            .HasDatabaseName("IX_GroupMembers_GroupId_UserId");

        builder.HasIndex(gm => gm.UserId)
            .HasDatabaseName("IX_GroupMembers_UserId");

        builder.ToTable("GroupMembers");
    }
}
