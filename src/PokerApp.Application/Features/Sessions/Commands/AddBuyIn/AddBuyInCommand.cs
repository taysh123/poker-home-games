using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.AddBuyIn;

public sealed record AddBuyInCommand(Guid SessionId, Guid SessionPlayerId, decimal Amount)
    : IRequest<AddBuyInResponse>;

public sealed record AddBuyInResponse(
    Guid Id, Guid SessionId, Guid SessionPlayerId, decimal Amount, DateTime Timestamp);
