using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Debts.Commands.MarkDebtPaid;

public sealed class MarkDebtPaidCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<MarkDebtPaidCommand>
{
    public async Task Handle(MarkDebtPaidCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var debt = await context.Debts
            .FirstOrDefaultAsync(d => d.Id == request.DebtId, cancellationToken)
            ?? throw new NotFoundException(nameof(Debt), request.DebtId);

        if (debt.FromUserId != callerId && debt.ToUserId != callerId)
            throw new UnauthorizedException("Only the payer or receiver can mark a debt as paid.");

        if (debt.Status != SettlementStatus.Pending)
            throw new BadRequestException("Only pending debts can be marked as paid.");

        debt.MarkAsPaid();
        await context.SaveChangesAsync(cancellationToken);
    }
}
