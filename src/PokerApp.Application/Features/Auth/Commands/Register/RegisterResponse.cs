namespace PokerApp.Application.Features.Auth.Commands.Register;

public sealed record RegisterResponse(
    Guid UserId,
    string Username,
    string Email,
    string AccessToken,
    string RefreshToken);
