using MediatR;

namespace PokerApp.Application.Features.Debts.Commands.CreateDebt;

public sealed record CreateDebtCommand(
    Guid GroupId,
    Guid FromUserId,
    Guid ToUserId,
    decimal Amount,
    string? Reason) : IRequest<DebtDto>;

public sealed record DebtDto(
    Guid Id,
    Guid GroupId,
    string GroupName,
    Guid FromUserId,
    string FromUsername,
    Guid ToUserId,
    string ToUsername,
    decimal Amount,
    string? Reason,
    string Status,
    DateTime CreatedAt);
