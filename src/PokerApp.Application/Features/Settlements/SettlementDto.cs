namespace PokerApp.Application.Features.Settlements;

public sealed record SettlementDto(
    Guid Id,
    Guid PayerUserId,
    string PayerName,
    Guid ReceiverUserId,
    string ReceiverName,
    decimal Amount,
    string Status
);

public sealed record GuestBalanceDto(
    Guid SessionPlayerId,
    string GuestName,
    decimal NetBalance
);

public sealed record CalculateSettlementsResult(
    List<SettlementDto> Settlements,
    List<GuestBalanceDto> GuestBalances
);
