using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

/// <summary>
/// Records a processed store notification for idempotency/dedupe (replay-safe webhooks).
/// </summary>
public class StoreWebhookEvent : BaseEntity
{
    public SubscriptionStore Store { get; private set; }
    public string NotificationUuid { get; private set; } = string.Empty;
    public string Type { get; private set; } = string.Empty;
    public DateTime ProcessedAtUtc { get; private set; }

    private StoreWebhookEvent() { }

    public static StoreWebhookEvent Create(SubscriptionStore store, string notificationUuid, string type) =>
        new() { Store = store, NotificationUuid = notificationUuid, Type = type, ProcessedAtUtc = DateTime.UtcNow };
}
