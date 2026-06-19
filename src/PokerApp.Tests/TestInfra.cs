using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Infrastructure.Identity;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Tests;

/// <summary>Test helpers: isolated in-memory DbContext, a real JwtService, and auth fakes.</summary>
internal static class TestInfra
{
    public static AppDbContext NewContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    public static JwtService Jwt() => new(new JwtSettings
    {
        SecretKey = "test-secret-key-at-least-32-characters-long-000",
        Issuer = "TPokerTest",
        Audience = "TPokerTest",
        AccessTokenExpirationMinutes = 15,
        RefreshTokenExpirationDays = 30,
    });
}

internal sealed class FakeGoogleAuth(GoogleUserInfo? result) : IGoogleAuthService
{
    public Task<GoogleUserInfo?> ValidateIdTokenAsync(string idToken, CancellationToken ct = default) => Task.FromResult(result);
}

internal sealed class FakeAppleAuth(AppleUserInfo? result) : IAppleAuthService
{
    public Task<AppleUserInfo?> ValidateIdentityTokenAsync(string identityToken, string? expectedNonce = null, CancellationToken ct = default)
        => Task.FromResult(result);
}

internal sealed class TestAuthPolicy(bool allowEmailRegistration = false, bool allowEmailLinking = true) : IAuthPolicy
{
    public bool AllowEmailRegistration { get; } = allowEmailRegistration;
    public bool AllowEmailLinking { get; } = allowEmailLinking;
}

internal sealed class NoopAbuseGuard : IAuthAbuseGuard
{
    public Task RecordFailedLoginAsync(string emailOrUser, CancellationToken ct = default) => Task.CompletedTask;
    public Task RecordSocialLoginAsync(string provider, Guid userId, CancellationToken ct = default) => Task.CompletedTask;
    public Task RecordRefreshReuseAsync(Guid userId, CancellationToken ct = default) => Task.CompletedTask;
}

internal sealed class PlainPasswordHasher : IPasswordHasher
{
    public string Hash(string password) => "hash:" + password;
    public bool Verify(string password, string hash) => hash == "hash:" + password;
}
