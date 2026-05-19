using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.AddPlayer;

public sealed record AddPlayerCommand(
    Guid SessionId,
    Guid? UserId,
    string? GuestName,
    Guid? LinkedUserId = null) : IRequest<AddPlayerResponse>;

public sealed record AddPlayerResponse(
    Guid SessionPlayerId,
    Guid SessionId,
    Guid? UserId,
    string? GuestName,
    bool IsGuest,
    Guid? LinkedUserId);
