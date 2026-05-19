using MediatR;

namespace PokerApp.Application.Features.Debts.Commands.MarkDebtPaid;

public sealed record MarkDebtPaidCommand(Guid DebtId) : IRequest;
