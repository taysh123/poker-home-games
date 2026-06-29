using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Verifies a Google-signed OIDC token (Pub/Sub push authentication): issuer = Google,
/// audience = the configured push endpoint, valid lifetime, signature against Google's keys.
/// Pure + deterministic (keys + now injected) → unit-testable offline. Returns false on any failure.
/// </summary>
public static class GoogleOidcVerifier
{
    private static readonly string[] ValidIssuers = ["https://accounts.google.com", "accounts.google.com"];

    public static bool Verify(string token, IEnumerable<SecurityKey> signingKeys, string audience, DateTime nowUtc)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(audience)) return false;
        try
        {
            new JwtSecurityTokenHandler().ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuers = ValidIssuers,
                ValidateAudience = true,
                ValidAudience = audience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKeys = signingKeys,
                ValidateLifetime = true,
                LifetimeValidator = (nb, exp, _, _) => (nb is null || nb <= nowUtc) && (exp is null || exp > nowUtc),
            }, out _);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
