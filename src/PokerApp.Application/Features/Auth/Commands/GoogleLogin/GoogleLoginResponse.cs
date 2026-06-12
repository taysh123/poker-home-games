namespace PokerApp.Application.Features.Auth.Commands.GoogleLogin;

public sealed record GoogleLoginResponse(
    Guid UserId,
    string Username,
    string Email,
    string AccessToken,
    string RefreshToken,
    string? AvatarEmoji,
    string? AvatarColor);
