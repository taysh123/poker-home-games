using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.AddCashOut;

public sealed record AddCashOutCommand(Guid SessionId, Guid UserId, decimal Amount)
    : IRequest<AddCashOutResponse>;

public sealed record AddCashOutResponse(
    Guid Id, Guid SessionId, Guid UserId, decimal Amount, DateTime Timestamp);
