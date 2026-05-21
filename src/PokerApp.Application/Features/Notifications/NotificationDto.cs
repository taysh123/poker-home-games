namespace PokerApp.Application.Features.Notifications;

public sealed record NotificationDto(
    Guid Id,
    string Type,
    string Title,
    string Body,
    Guid? RelatedEntityId,
    bool IsRead,
    DateTime CreatedAt
);
