using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Debts.Commands.CancelDebt;

public sealed class CancelDebtCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CancelDebtCommand>
{
    public async Task Handle(CancelDebtCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var debt = await context.Debts
            .FirstOrDefaultAsync(d => d.Id == request.DebtId, cancellationToken)
            ?? throw new NotFoundException(nameof(Debt), request.DebtId);

        if (debt.CreatedByUserId != callerId)
            throw new UnauthorizedException("Only the creator can cancel a debt.");

        if (debt.Status != SettlementStatus.Pending)
            throw new BadRequestException("Only pending debts can be cancelled.");

        debt.Cancel();
        await context.SaveChangesAsync(cancellationToken);
    }
}
