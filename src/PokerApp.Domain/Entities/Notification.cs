using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public Guid? RelatedEntityId { get; set; }
    public bool IsRead { get; set; }

    public static Notification Create(Guid userId, NotificationType type, string title, string body, Guid? relatedEntityId = null)
        => new()
        {
            UserId          = userId,
            Type            = type,
            Title           = title,
            Body            = body,
            RelatedEntityId = relatedEntityId,
            IsRead          = false,
        };
}
