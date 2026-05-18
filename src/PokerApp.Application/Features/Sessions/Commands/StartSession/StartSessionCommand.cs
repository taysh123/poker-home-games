using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.StartSession;

public sealed record StartSessionCommand(Guid SessionId) : IRequest;
