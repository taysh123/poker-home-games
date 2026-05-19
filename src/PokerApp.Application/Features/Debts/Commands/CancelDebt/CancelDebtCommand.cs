using MediatR;

namespace PokerApp.Application.Features.Debts.Commands.CancelDebt;

public sealed record CancelDebtCommand(Guid DebtId) : IRequest;
