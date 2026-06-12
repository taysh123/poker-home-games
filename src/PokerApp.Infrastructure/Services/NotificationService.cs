using Microsoft.Extensions.Logging;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Infrastructure.Services;

public class NotificationService(
    AppDbContext context,
    IPushNotificationService pushNotificationService,
    ILogger<NotificationService> logger) : INotificationService
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

        await PushAsync([userId], type, title, body, relatedEntityId, cancellationToken);
    }

    public async Task NotifyManyAsync(
        IEnumerable<Guid> userIds,
        NotificationType type,
        string title,
        string body,
        Guid? relatedEntityId = null,
        CancellationToken cancellationToken = default)
    {
        var distinctUserIds = userIds.Distinct().ToList();

        var notifications = distinctUserIds
            .Select(uid => Notification.Create(uid, type, title, body, relatedEntityId))
            .ToList();

        if (notifications.Count == 0) return;

        await context.Notifications.AddRangeAsync(notifications, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        await PushAsync(distinctUserIds, type, title, body, relatedEntityId, cancellationToken);
    }

    /// <summary>Fires a push notification. Best-effort: never throws.</summary>
    private async Task PushAsync(
        IReadOnlyCollection<Guid> userIds,
        NotificationType type,
        string title,
        string body,
        Guid? relatedEntityId,
        CancellationToken cancellationToken)
    {
        try
        {
            await pushNotificationService.SendAsync(
                userIds,
                title,
                body,
                new { type = type.ToString(), relatedEntityId },
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Push notification delivery failed (best-effort, ignored).");
        }
    }
}
