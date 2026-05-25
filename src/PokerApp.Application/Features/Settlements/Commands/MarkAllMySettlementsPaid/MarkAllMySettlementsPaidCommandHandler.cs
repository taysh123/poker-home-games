using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Settlements.Commands.MarkAllMySettlementsPaid;

public sealed class MarkAllMySettlementsPaidCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    INotificationService notificationService) : IRequestHandler<MarkAllMySettlementsPaidCommand, int>
{
    public async Task<int> Handle(MarkAllMySettlementsPaidCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var pending = await context.Settlements
            .Where(s => s.PayerUserId == callerId && s.Status == SettlementStatus.Pending)
            .ToListAsync(cancellationToken);

        if (pending.Count == 0)
            return 0;

        foreach (var s in pending)
            s.MarkAsPaid();

        await context.SaveChangesAsync(cancellationToken);

        // Notify each unique receiver once (best-effort)
        try
        {
            var payerName = await context.Users
                .Where(u => u.Id == callerId)
                .Select(u => u.Username)
                .FirstOrDefaultAsync(cancellationToken) ?? "Someone";

            var receiverIds = pending.Select(s => s.ReceiverUserId).Distinct();
            foreach (var receiverId in receiverIds)
            {
                await notificationService.NotifyAsync(
                    receiverId,
                    NotificationType.SettlementPaid,
                    "Settlements Paid",
                    $"{payerName} settled all pending debts.",
                    null,
                    cancellationToken);
            }
        }
        catch { /* notifications are non-critical */ }

        return pending.Count;
    }
}
