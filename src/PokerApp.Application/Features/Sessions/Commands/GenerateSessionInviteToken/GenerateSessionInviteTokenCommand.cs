using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.GenerateSessionInviteToken;

public sealed record GenerateSessionInviteTokenCommand(Guid SessionId) : IRequest<GenerateSessionInviteTokenResponse>;

public sealed record GenerateSessionInviteTokenResponse(string Token, string DeepLinkUrl, DateTime ExpiresAt);
