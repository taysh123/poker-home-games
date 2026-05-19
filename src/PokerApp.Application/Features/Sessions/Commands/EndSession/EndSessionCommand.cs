using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.EndSession;

public sealed record FinalStackItem(Guid SessionPlayerId, decimal Amount);

public sealed record EndSessionCommand(
    Guid SessionId,
    IReadOnlyList<FinalStackItem>? FinalStacks = null) : IRequest;
