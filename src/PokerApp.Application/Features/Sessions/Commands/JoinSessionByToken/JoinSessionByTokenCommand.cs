using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.JoinSessionByToken;

public sealed record JoinSessionByTokenCommand(string Token) : IRequest<JoinSessionByTokenResponse>;

public sealed record JoinSessionByTokenResponse(
    Guid SessionId,
    string SessionName,
    string SessionStatus,
    Guid SessionPlayerId,
    Guid? GroupId);
