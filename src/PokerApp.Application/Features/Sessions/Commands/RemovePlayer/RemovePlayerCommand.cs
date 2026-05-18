using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.RemovePlayer;

public sealed record RemovePlayerCommand(Guid SessionId, Guid UserId) : IRequest;
