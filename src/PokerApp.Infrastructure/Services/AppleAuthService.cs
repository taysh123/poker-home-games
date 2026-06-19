using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Validates Apple Sign In identity tokens server-side: RS256 signature against Apple's JWKS,
/// issuer (https://appleid.apple.com), audience (AppleSettings:ClientIds), expiry, and the
/// nonce when supplied. Fail-closed: returns null on any validation failure or if Apple is not
/// configured. JWKS is cached briefly to avoid a fetch per request.
/// </summary>
public sealed class AppleAuthService(IConfiguration configuration, IHttpClientFactory httpClientFactory) : IAppleAuthService
{
    private const string Issuer = "https://appleid.apple.com";
    private const string JwksUrl = "https://appleid.apple.com/auth/keys";

    private static JsonWebKeySet? _cachedKeys;
    private static DateTime _cachedAtUtc;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(1);
    private static readonly SemaphoreSlim KeyLock = new(1, 1);

    public async Task<AppleUserInfo?> ValidateIdentityTokenAsync(
        string identityToken, string? expectedNonce = null, CancellationToken ct = default)
    {
        var clientIds = configuration.GetSection("AppleSettings:ClientIds").Get<IList<string>>();
        if (clientIds is null || clientIds.Count == 0) return null; // Apple not configured → fail closed

        try
        {
            var keys = await GetSigningKeysAsync(ct);
            if (keys is null) return null;

            var parameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = Issuer,
                ValidateAudience = true,
                ValidAudiences = clientIds,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKeys = keys.GetSigningKeys(),
                ClockSkew = TimeSpan.FromSeconds(30),
            };

            var handler = new JwtSecurityTokenHandler();
            handler.ValidateToken(identityToken, parameters, out var validated);
            var jwt = (JwtSecurityToken)validated;

            var sub = jwt.Subject;
            if (string.IsNullOrEmpty(sub)) return null;

            if (expectedNonce is not null)
            {
                var nonce = jwt.Claims.FirstOrDefault(c => c.Type == "nonce")?.Value;
                if (nonce != expectedNonce) return null; // nonce mismatch → reject
            }

            var email = jwt.Claims.FirstOrDefault(c => c.Type == "email")?.Value;
            var emailVerified = string.Equals(
                jwt.Claims.FirstOrDefault(c => c.Type == "email_verified")?.Value, "true",
                StringComparison.OrdinalIgnoreCase);
            var isPrivateRelay = string.Equals(
                jwt.Claims.FirstOrDefault(c => c.Type == "is_private_email")?.Value, "true",
                StringComparison.OrdinalIgnoreCase);

            return new AppleUserInfo(sub, string.IsNullOrWhiteSpace(email) ? null : email, emailVerified, isPrivateRelay);
        }
        catch (Exception ex) when (ex is SecurityTokenException or ArgumentException or InvalidOperationException)
        {
            return null; // invalid/expired token, bad audience, etc.
        }
    }

    private async Task<JsonWebKeySet?> GetSigningKeysAsync(CancellationToken ct)
    {
        if (_cachedKeys is not null && DateTime.UtcNow - _cachedAtUtc < CacheTtl) return _cachedKeys;
        await KeyLock.WaitAsync(ct);
        try
        {
            if (_cachedKeys is not null && DateTime.UtcNow - _cachedAtUtc < CacheTtl) return _cachedKeys;
            var http = httpClientFactory.CreateClient();
            var json = await http.GetStringAsync(JwksUrl, ct);
            _cachedKeys = new JsonWebKeySet(json);
            _cachedAtUtc = DateTime.UtcNow;
            return _cachedKeys;
        }
        catch
        {
            return _cachedKeys; // serve stale on transient fetch failure (or null)
        }
        finally
        {
            KeyLock.Release();
        }
    }
}
