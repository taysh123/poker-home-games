namespace PokerApp.Application.Common.Interfaces;

public sealed record GoogleUserInfo(string GoogleId, string Email, string Name);

public interface IGoogleAuthService
{
    // Returns null if the token is invalid or expired
    Task<GoogleUserInfo?> ValidateIdTokenAsync(string idToken, CancellationToken ct = default);
}
