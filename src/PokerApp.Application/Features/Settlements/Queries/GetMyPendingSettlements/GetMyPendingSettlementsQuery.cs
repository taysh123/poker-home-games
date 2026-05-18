using MediatR;

namespace PokerApp.Application.Features.Settlements.Queries.GetMyPendingSettlements;

public sealed record GetMyPendingSettlementsQuery : IRequest<List<MyPendingSettlementDto>>;

public sealed record MyPendingSettlementDto(
    Guid Id,
    Guid SessionId,
    string SessionName,
    string GroupName,
    Guid PayerUserId,
    string PayerName,
    Guid ReceiverUserId,
    string ReceiverName,
    decimal Amount
);
