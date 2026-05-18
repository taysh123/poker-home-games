using PokerApp.Domain.Entities;

namespace PokerApp.Application.Common.Interfaces;

public interface IJwtService
{
    string GenerateAccessToken(User user);

    // Returns the plain token (sent to client), its SHA-256 hash (stored in DB),
    // and the absolute expiry timestamp so the handler can persist it without
    // knowing anything about JwtSettings.
    (string Token, string Hash, DateTime ExpiresAt) GenerateRefreshToken();

    // Hashes an incoming token for DB lookup — same algorithm as GenerateRefreshToken.
    string HashToken(string token);
}
