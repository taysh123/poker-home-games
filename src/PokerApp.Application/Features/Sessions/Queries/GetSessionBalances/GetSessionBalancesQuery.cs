using MediatR;

namespace PokerApp.Application.Features.Sessions.Queries.GetSessionBalances;

public sealed record GetSessionBalancesQuery(Guid SessionId)
    : IRequest<SessionBalancesDto>;

public sealed record PlayerBalanceDto(
    Guid SessionPlayerId,
    string Username,
    decimal TotalBuyIn,
    decimal TotalCashOut,
    decimal ProfitLoss,
    bool IsGuest);

public sealed record SessionBalancesDto(
    Guid SessionId,
    string SessionName,
    string Status,
    decimal TotalPot,
    IReadOnlyList<PlayerBalanceDto> Players);
