using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class GroupMember : BaseEntity
{
    public Guid GroupId { get; private set; }
    public Group Group { get; private set; } = null!;
    public Guid UserId { get; private set; }
    public User User { get; private set; } = null!;
    public GroupRole Role { get; private set; }
    public DateTime JoinedAt { get; private set; }

    private GroupMember() { }

    public static GroupMember Create(Guid groupId, Guid userId, GroupRole role)
        => new()
        {
            GroupId = groupId,
            UserId = userId,
            Role = role,
            JoinedAt = DateTime.UtcNow
        };

    public void SetRole(GroupRole role) => Role = role;
}
