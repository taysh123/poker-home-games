using MediatR;

namespace PokerApp.Application.Features.Settlements.Commands.MarkAllMySettlementsPaid;

public sealed record MarkAllMySettlementsPaidCommand : IRequest<int>;
