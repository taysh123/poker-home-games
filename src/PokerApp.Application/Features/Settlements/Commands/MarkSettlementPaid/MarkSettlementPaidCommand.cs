using MediatR;

namespace PokerApp.Application.Features.Settlements.Commands.MarkSettlementPaid;

public sealed record MarkSettlementPaidCommand(Guid SettlementId) : IRequest;
