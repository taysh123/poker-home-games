using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.CreateSession;

public sealed record CreateSessionCommand(
    Guid GroupId,
    string Name,
    decimal SmallBlind,
    decimal BigBlind) : IRequest<CreateSessionResponse>;

public sealed record CreateSessionResponse(
    Guid Id,
    string Name,
    Guid GroupId,
    string Status,
    decimal SmallBlind,
    decimal BigBlind,
    DateTime CreatedAt);
