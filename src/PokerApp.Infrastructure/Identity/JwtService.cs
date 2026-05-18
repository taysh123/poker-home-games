using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Infrastructure.Identity;

public class JwtService(JwtSettings settings) : IJwtService
{
    public string GenerateAccessToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Username),
            // AppRole embedded in the token enables [Authorize(Roles = "Admin")]
            // without a database round-trip on every request.
            new Claim(ClaimTypes.Role, user.AppRole.ToString()),
            // jti makes each token unique — required for future token revocation lists.
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SecretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: settings.Issuer,
            audience: settings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(settings.AccessTokenExpirationMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public (string Token, string Hash, DateTime ExpiresAt) GenerateRefreshToken()
    {
        // 64 cryptographically random bytes → ~86 base64 chars.
        // This gives 512 bits of entropy — far beyond brute-force range.
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        var token = Convert.ToBase64String(randomBytes);
        var hash = HashToken(token);
        var expiresAt = DateTime.UtcNow.AddDays(settings.RefreshTokenExpirationDays);

        return (token, hash, expiresAt);
    }

    public string HashToken(string token)
    {
        // SHA-256 is appropriate here: we control the token format (64 random bytes),
        // so there is no dictionary/brute-force risk. BCrypt is unnecessary.
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
