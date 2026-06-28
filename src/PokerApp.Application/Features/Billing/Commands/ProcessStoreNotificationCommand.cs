using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Billing.Commands;

/// <summary>Normalized store notification. The base fields exist for all stores; the optional fields are
/// populated for stores whose webhook can CREATE a subscription on first purchase (Stripe/Paddle carry the user
/// via custom_data/metadata + the plan price + the billing period). Apple/Google leave them null.</summary>
public sealed record StoreNotificationDto(
    string NotificationUuid,
    string Type,                 // renew | cancel | expire | grace | refund
    string OriginalTransactionId,
    DateTime EventAtUtc,
    DateTime? PeriodEnd)
{
    public Guid? UserId { get; init; }
    public string? ProductId { get; init; }
    public DateTime? PeriodStart { get; init; }
}

public sealed record ProcessStoreNotificationCommand(string Store, StoreNotificationDto Notification) : IRequest<Unit>;

/// <summary>Idempotent webhook processing → drives server-authoritative subscription state.</summary>
public sealed class ProcessStoreNotificationCommandHandler(
    IApplicationDbContext context,
    IAuditLog audit) : IRequestHandler<ProcessStoreNotificationCommand, Unit>
{
    public async Task<Unit> Handle(ProcessStoreNotificationCommand request, CancellationToken cancellationToken)
    {
        var n = request.Notification;
        if (!SubscriptionStoreParser.TryParse(request.Store, out var store))
        {
            audit.Record(AuditCategory.WebhookProcessing, "unknown_store", null, new { store = request.Store });
            return Unit.Value;
        }

        // Idempotency / replay protection.
        if (await context.StoreWebhookEvents.AnyAsync(e => e.NotificationUuid == n.NotificationUuid, cancellationToken))
        {
            audit.Record(AuditCategory.WebhookProcessing, "duplicate_ignored", null,
                new { store = request.Store, n.NotificationUuid });
            return Unit.Value;
        }

        var sub = await context.Subscriptions.FirstOrDefaultAsync(
            s => s.Store == store && s.OriginalTransactionId == n.OriginalTransactionId, cancellationToken);

        if (sub is null)
        {
            // First-purchase grant: only stores that supply the user + period can create (Stripe/Paddle).
            // Apple/Google leave UserId null here and fall through to the existing no-op (unchanged behaviour).
            if (n.Type == "renew" && n.UserId is Guid uid)
            {
                sub = Subscription.Create(uid, store, n.ProductId ?? string.Empty, n.OriginalTransactionId,
                    n.PeriodStart ?? n.EventAtUtc, n.PeriodEnd ?? n.EventAtUtc.AddMonths(1),
                    autoRenew: true, isSandbox: false, n.EventAtUtc);
                await context.Subscriptions.AddAsync(sub, cancellationToken);
            }
        }
        else
        {
            switch (n.Type)
            {
                case "renew":
                    sub.Sync(sub.ProductId, sub.CurrentPeriodStart, n.PeriodEnd ?? sub.CurrentPeriodEnd,
                        autoRenew: true, sub.IsSandbox, SubscriptionStatus.Active, n.EventAtUtc);
                    break;
                case "cancel": sub.MarkCanceled(n.EventAtUtc); break;
                case "expire": sub.MarkExpired(n.EventAtUtc); break;
                case "grace": sub.MarkGrace(n.EventAtUtc); break;
                case "refund": sub.MarkRefunded(n.EventAtUtc); break;
            }
        }

        await context.StoreWebhookEvents.AddAsync(
            StoreWebhookEvent.Create(store, n.NotificationUuid, n.Type), cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        audit.Record(AuditCategory.WebhookProcessing, "processed", sub?.UserId,
            new { store = request.Store, n.Type, n.OriginalTransactionId });
        if (sub is not null)
            audit.Record(AuditCategory.SubscriptionLifecycle, n.Type, sub.UserId,
                new { store = request.Store, status = sub.Status.ToString() });
        return Unit.Value;
    }
}
