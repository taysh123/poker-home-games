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

    // Loose reference to the session this event relates to (no navigation/FK on purpose:
    // sessions may be deleted while their activity history remains).
    public Guid? RelatedSessionId { get; private set; }

    private ActivityLog() { }

    public static ActivityLog Create(
        Guid groupId,
        Guid? actorUserId,
        string actorName,
        ActivityType type,
        string description,
        Guid? relatedSessionId = null)
        => new()
        {
            GroupId = groupId,
            ActorUserId = actorUserId,
            ActorName = actorName,
            Type = type,
            Description = description,
            RelatedSessionId = relatedSessionId,
        };
}
