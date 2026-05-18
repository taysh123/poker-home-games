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
