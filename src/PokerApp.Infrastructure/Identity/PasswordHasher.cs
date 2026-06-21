using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Identity;

public class PasswordHasher : IPasswordHasher
{
    // Work factor 13 ≈ 500ms on modern hardware (NIST-aligned 2023 guidance).
    // Fast enough for UX; slow enough to make offline brute-force economically unviable.
    // BCrypt's adaptive cost is backward-compatible: Verify reads the cost from each stored hash, so
    // raising this does NOT invalidate existing (cost-12) hashes — they re-hash at 13 on next login.
    private const int WorkFactor = 13;

    public string Hash(string password) =>
        BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    public bool Verify(string password, string hash) =>
        BCrypt.Net.BCrypt.Verify(password, hash);
}
