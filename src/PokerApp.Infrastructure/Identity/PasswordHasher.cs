using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Identity;

public class PasswordHasher : IPasswordHasher
{
    // Work factor 12 ≈ 250ms on modern hardware.
    // Fast enough for UX; slow enough to make offline brute-force economically unviable.
    // BCrypt's adaptive cost means you can raise this over time without invalidating
    // existing hashes — just re-hash on the next successful login.
    private const int WorkFactor = 12;

    public string Hash(string password) =>
        BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    public bool Verify(string password, string hash) =>
        BCrypt.Net.BCrypt.Verify(password, hash);
}
