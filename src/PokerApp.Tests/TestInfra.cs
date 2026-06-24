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

internal sealed class TestCurrentUser(Guid userId) : ICurrentUserService
{
    public Guid UserId { get; } = userId;
    public string? Email => "test@me.com";
    public string? Username => "test";
    public bool IsAuthenticated => true;
}

/// <summary>Captures audit events so tests can assert observability wiring.</summary>
internal sealed class CapturingAuditLog : IAuditLog
{
    public readonly List<(AuditCategory Category, string Action, Guid? UserId)> Events = new();
    public void Record(AuditCategory category, string action, Guid? userId = null, object? data = null)
        => Events.Add((category, action, userId));
    public bool Has(AuditCategory category) => Events.Exists(e => e.Category == category);
}
