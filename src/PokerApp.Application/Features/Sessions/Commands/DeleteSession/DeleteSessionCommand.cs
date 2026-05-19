using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.DeleteSession;

public sealed record DeleteSessionCommand(Guid SessionId) : IRequest;
