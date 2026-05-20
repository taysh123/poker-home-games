using MediatR;

namespace PokerApp.Application.Features.Settlements.Commands.CalculateSettlements;

public sealed record CalculateSettlementsCommand(Guid SessionId) : IRequest<CalculateSettlementsResult>;
