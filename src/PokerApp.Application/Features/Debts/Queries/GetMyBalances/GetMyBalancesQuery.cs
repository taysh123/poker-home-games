using MediatR;

namespace PokerApp.Application.Features.Debts.Queries.GetMyBalances;

public sealed record GetMyBalancesQuery : IRequest<IReadOnlyList<BalanceEntryDto>>;

public sealed record BalanceEntryDto(
    Guid UserId,
    string Username,
    decimal NetBalance,
    IReadOnlyList<BalanceItemDto> Items);

public sealed record BalanceItemDto(
    Guid ItemId,
    string Type,
    decimal Amount,
    bool YouOwe,
    string Description,
    Guid? SessionId);
