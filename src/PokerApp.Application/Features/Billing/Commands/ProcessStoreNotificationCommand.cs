using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Billing.Commands;

/// <summary>Normalized store notification (the signature-verified payload is parsed into this by the
/// webhook layer; real Apple ASSN / Google RTDN verification is a deferred seam).</summary>
public sealed record StoreNotificationDto(
    string NotificationUuid,
    string Type,                 // renew | cancel | expire | grace | refund
    string OriginalTransactionId,
    DateTime EventAtUtc,
    DateTime? PeriodEnd);

public sealed record ProcessStoreNotificationCommand(string Store, StoreNotificationDto Notification) : IRequest<Unit>;

/// <summary>Idempotent webhook processing → drives server-authoritative subscription state.</summary>
public sealed class ProcessStoreNotificationCommandHandler(
    IApplicationDbContext context) : IRequestHandler<ProcessStoreNotificationCommand, Unit>
{
    public async Task<Unit> Handle(ProcessStoreNotificationCommand request, CancellationToken cancellationToken)
    {
        var n = request.Notification;
        var store = request.Store == "apple" ? SubscriptionStore.Apple : SubscriptionStore.Google;

        // Idempotency / replay protection.
        if (await context.StoreWebhookEvents.AnyAsync(e => e.NotificationUuid == n.NotificationUuid, cancellationToken))
            return Unit.Value;

        var sub = await context.Subscriptions.FirstOrDefaultAsync(
            s => s.Store == store && s.OriginalTransactionId == n.OriginalTransactionId, cancellationToken);

        if (sub is not null)
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
        return Unit.Value;
    }
}
