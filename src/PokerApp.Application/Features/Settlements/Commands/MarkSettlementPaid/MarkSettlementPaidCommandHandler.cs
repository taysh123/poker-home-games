using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Settlements.Commands.MarkSettlementPaid;

public sealed class MarkSettlementPaidCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<MarkSettlementPaidCommand>
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
    }
}
