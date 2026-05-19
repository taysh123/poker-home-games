using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class ActivityLog : BaseEntity
{
    public Guid GroupId { get; private set; }
    public Group Group { get; private set; } = null!;

    public Guid? ActorUserId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;

    public ActivityType Type { get; private set; }
    public string Description { get; private set; } = string.Empty;

    private ActivityLog() { }

    public static ActivityLog Create(
        Guid groupId,
        Guid? actorUserId,
        string actorName,
        ActivityType type,
        string description)
        => new()
        {
            GroupId = groupId,
            ActorUserId = actorUserId,
            ActorName = actorName,
            Type = type,
            Description = description,
        };
}
