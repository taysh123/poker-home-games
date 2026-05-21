using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Settlements.Commands.MarkSettlementPaid;

public sealed class MarkSettlementPaidCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    INotificationService notificationService) : IRequestHandler<MarkSettlementPaidCommand>
{
    public async Task Handle(MarkSettlementPaidCommand request, CancellationToken cancellationToken)
    {
        var settlement = await context.Settlements
            .FirstOrDefaultAsync(s => s.Id == request.SettlementId, cancellationToken)
            ?? throw new NotFoundException(nameof(Settlement), request.SettlementId);

        var callerId = currentUserService.UserId;
        if (settlement.PayerUserId != callerId && settlement.ReceiverUserId != callerId)
            throw new UnauthorizedException("Only the payer or receiver can mark a settlement as paid.");

        if (settlement.Status == SettlementStatus.Confirmed)
            throw new BadRequestException("This settlement is already marked as paid.");

        settlement.MarkAsPaid();
        await context.SaveChangesAsync(cancellationToken);

        // Notify receiver that their debt was settled (best-effort)
        try
        {
            var payerName = (await context.Users
                .Where(u => u.Id == callerId)
                .Select(u => u.Username)
                .FirstOrDefaultAsync(cancellationToken)) ?? "Someone";

            var notifyUserId = callerId == settlement.PayerUserId
                ? settlement.ReceiverUserId
                : settlement.PayerUserId;

            await notificationService.NotifyAsync(
                notifyUserId,
                NotificationType.SettlementPaid,
                "Settlement Paid",
                $"{payerName} marked a settlement of {settlement.Amount:C0} as paid.",
                settlement.Id,
                cancellationToken);
        }
        catch { /* notifications are non-critical */ }
    }
}
