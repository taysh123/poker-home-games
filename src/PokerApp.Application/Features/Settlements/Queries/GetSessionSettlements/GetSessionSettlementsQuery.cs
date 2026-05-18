using MediatR;

namespace PokerApp.Application.Features.Settlements.Queries.GetSessionSettlements;

public sealed record SessionSettlementsDto(
    Guid SessionId,
    decimal TotalPot,
    List<SettlementDto> Settlements
);

public sealed record GetSessionSettlementsQuery(Guid SessionId) : IRequest<SessionSettlementsDto>;
