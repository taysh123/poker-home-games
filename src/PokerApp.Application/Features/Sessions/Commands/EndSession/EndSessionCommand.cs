using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.EndSession;

public sealed record EndSessionCommand(Guid SessionId) : IRequest;
