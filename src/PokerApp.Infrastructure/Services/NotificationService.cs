using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Infrastructure.Services;

public class NotificationService(AppDbContext context) : INotificationService
{
    public async Task NotifyAsync(
        Guid userId,
        NotificationType type,
        string title,
        string body,
        Guid? relatedEntityId = null,
        CancellationToken cancellationToken = default)
    {
        var n = Notification.Create(userId, type, title, body, relatedEntityId);
        await context.Notifications.AddAsync(n, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task NotifyManyAsync(
        IEnumerable<Guid> userIds,
        NotificationType type,
        string title,
        string body,
        Guid? relatedEntityId = null,
        CancellationToken cancellationToken = default)
    {
        var notifications = userIds
            .Distinct()
            .Select(uid => Notification.Create(uid, type, title, body, relatedEntityId))
            .ToList();

        if (notifications.Count == 0) return;

        await context.Notifications.AddRangeAsync(notifications, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
    }
}
