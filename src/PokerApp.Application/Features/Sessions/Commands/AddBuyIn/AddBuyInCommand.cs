using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.AddBuyIn;

public sealed record AddBuyInCommand(Guid SessionId, Guid UserId, decimal Amount)
    : IRequest<AddBuyInResponse>;

public sealed record AddBuyInResponse(
    Guid Id, Guid SessionId, Guid UserId, decimal Amount, DateTime Timestamp);
