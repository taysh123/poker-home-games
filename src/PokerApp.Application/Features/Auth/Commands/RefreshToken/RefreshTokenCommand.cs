using MediatR;

namespace PokerApp.Application.Features.Auth.Commands.RefreshToken;

public sealed record RefreshTokenCommand(string Token) : IRequest<RefreshTokenResponse>;
