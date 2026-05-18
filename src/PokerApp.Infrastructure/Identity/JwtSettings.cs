namespace PokerApp.Infrastructure.Identity;

public class JwtSettings
{
    public string SecretKey { get; init; } = string.Empty;
    public string Issuer { get; init; } = string.Empty;
    public string Audience { get; init; } = string.Empty;
    // Short-lived access tokens limit the damage window if a token is stolen.
    // 15 minutes is the industry standard; adjust per your threat model.
    public int AccessTokenExpirationMinutes { get; init; } = 15;
    public int RefreshTokenExpirationDays { get; init; } = 30;
}
