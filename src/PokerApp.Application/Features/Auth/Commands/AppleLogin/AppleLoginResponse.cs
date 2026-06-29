namespace PokerApp.Application.Features.Auth.Commands.AppleLogin;

public sealed record AppleLoginResponse(
    Guid UserId,
    string Username,
    string Email,
    string AccessToken,
    string RefreshToken,
    string? AvatarEmoji,
    string? AvatarColor);
