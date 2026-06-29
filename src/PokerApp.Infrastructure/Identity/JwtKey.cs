using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace PokerApp.Infrastructure.Identity;

/// <summary>
/// Resolves the JWT signing key fail-closed. HMAC-SHA256 requires a key of at least 256 bits (32 bytes).
/// Previously a short/missing secret was silently padded so the container could boot — but tokens signed with a
/// padded key never validate, so auth was silently broken. This helper makes that a LOUD failure outside
/// Development (production requires a >=64-char secret per the deployment checklist, so a correctly-configured
/// prod is unaffected), while keeping local Development tolerant so it boots without a configured secret.
/// Lives beside <see cref="JwtService"/>; unit-tested in PokerApp.Tests.
/// </summary>
public static class JwtKey
{
    public const int MinSecretBytes = 32;

    /// <param name="requireStrongSecret">true outside Development — a secret shorter than the minimum throws.</param>
    public static SymmetricSecurityKey ResolveSigningKey(string? secret, bool requireStrongSecret)
    {
        var bytes = Encoding.UTF8.GetBytes(secret ?? string.Empty);
        if (bytes.Length < MinSecretBytes)
        {
            if (requireStrongSecret)
            {
                throw new InvalidOperationException(
                    $"JwtSettings:SecretKey must be at least {MinSecretBytes} bytes outside Development " +
                    $"(got {bytes.Length}). Set a strong secret (>=64 chars recommended) via the JwtSettings__SecretKey " +
                    "environment variable. Refusing to start with an unusable signing key.");
            }
            // Development only: pad so the middleware can construct and local dev boots without a secret.
            bytes = bytes.Concat(new byte[MinSecretBytes - bytes.Length]).ToArray();
        }
        return new SymmetricSecurityKey(bytes);
    }
}
