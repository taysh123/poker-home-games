using Microsoft.IdentityModel.Tokens;

namespace PokerApp.Infrastructure.Billing;

/// <summary>Supplies the public keys used to verify Google OIDC (Pub/Sub) tokens.</summary>
public interface IOidcKeySource
{
    Task<IReadOnlyCollection<SecurityKey>> GetKeysAsync(CancellationToken ct = default);
}

/// <summary>
/// Default Google key source — fetches Google's published JWKS. Network-bound (runs at deploy);
/// fails closed to an empty key set (⇒ OIDC verification fails) if it can't fetch. Cached.
/// </summary>
public sealed class GoogleOidcKeySource(IHttpClientFactory httpClientFactory) : IOidcKeySource
{
    private const string CertsUrl = "https://www.googleapis.com/oauth2/v3/certs";
    private static IReadOnlyCollection<SecurityKey>? _cache;
    private static DateTime _cachedAtUtc;
    private static readonly TimeSpan Ttl = TimeSpan.FromHours(1);

    public async Task<IReadOnlyCollection<SecurityKey>> GetKeysAsync(CancellationToken ct = default)
    {
        if (_cache is not null && DateTime.UtcNow - _cachedAtUtc < Ttl) return _cache;
        try
        {
            var json = await httpClientFactory.CreateClient().GetStringAsync(CertsUrl, ct);
            var jwks = new JsonWebKeySet(json);
            _cache = jwks.GetSigningKeys().ToList();
            _cachedAtUtc = DateTime.UtcNow;
            return _cache;
        }
        catch
        {
            return _cache ?? Array.Empty<SecurityKey>(); // fail closed
        }
    }
}
