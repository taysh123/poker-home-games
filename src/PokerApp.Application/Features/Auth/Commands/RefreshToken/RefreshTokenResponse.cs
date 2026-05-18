namespace PokerApp.Application.Features.Auth.Commands.RefreshToken;

public sealed record RefreshTokenResponse(
    string AccessToken,
    string RefreshToken);
