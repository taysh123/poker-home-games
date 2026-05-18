namespace PokerApp.Application.Features.Auth.Commands.Login;

public sealed record LoginResponse(
    Guid UserId,
    string Username,
    string Email,
    string AccessToken,
    string RefreshToken);
