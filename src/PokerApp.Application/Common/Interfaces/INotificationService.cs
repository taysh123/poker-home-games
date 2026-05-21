using PokerApp.Domain.Enums;

namespace PokerApp.Application.Common.Interfaces;

public interface INotificationService
{
    Task NotifyAsync(
        Guid userId,
        NotificationType type,
        string title,
        string body,
        Guid? relatedEntityId = null,
        CancellationToken cancellationToken = default);

    Task NotifyManyAsync(
        IEnumerable<Guid> userIds,
        NotificationType type,
        string title,
        string body,
        Guid? relatedEntityId = null,
        CancellationToken cancellationToken = default);
}
