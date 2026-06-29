using System.IdentityModel.Tokens.Jwt;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Auth.Commands.AppleLogin;
using PokerApp.Application.Features.Auth.Commands.ChangePassword;
using PokerApp.Application.Features.Auth.Commands.GoogleLogin;
using PokerApp.Application.Features.Auth.Commands.Register;
using PokerApp.Application.Features.Auth.Commands.RefreshToken;
using PokerApp.Domain.Entities;
using Xunit;

namespace PokerApp.Tests;

public class AppleLoginTests
{
    private static AppleLoginCommandHandler Handler(AppDbContextWrap w, AppleUserInfo? info, bool allowLink = true) =>
        new(w.Ctx, TestInfra.Jwt(), new FakeAppleAuth(info), new TestAuthPolicy(allowEmailLinking: allowLink), new NoopAbuseGuard());

    [Fact]
    public async Task ValidToken_RealVerifiedEmail_CreatesVerifiedAccount()
    {
        using var w = AppDbContextWrap.New();
        var res = await Handler(w, new AppleUserInfo("apple-sub-1", "real@me.com", true, false))
            .Handle(new AppleLoginCommand("tok"), default);

        var user = await w.Ctx.Users.SingleAsync();
        Assert.Equal("apple-sub-1", user.AppleSubjectId);
        Assert.True(user.EmailVerified);
        Assert.Equal("real@me.com", user.Email);
        Assert.False(string.IsNullOrEmpty(res.AccessToken));
        Assert.False(string.IsNullOrEmpty(res.RefreshToken));
    }

    [Fact]
    public async Task PrivateRelayOrNoEmail_CreatesAccount_WithPlaceholder_NotEmailVerified()
    {
        using var w = AppDbContextWrap.New();
        await Handler(w, new AppleUserInfo("apple-sub-2", null, false, false))
            .Handle(new AppleLoginCommand("tok"), default);

        var user = await w.Ctx.Users.SingleAsync();
        Assert.Equal("apple-sub-2", user.AppleSubjectId);
        Assert.False(user.EmailVerified);
        Assert.Contains("apple-sub-2", user.Email); // synthesized, non-matching placeholder
    }

    [Fact]
    public async Task ExistingBySubject_LogsInSameUser_NoDuplicate()
    {
        using var w = AppDbContextWrap.New();
        var info = new AppleUserInfo("apple-sub-3", "x@y.com", true, false);
        var first = await Handler(w, info).Handle(new AppleLoginCommand("tok"), default);
        var second = await Handler(w, info).Handle(new AppleLoginCommand("tok"), default);

        Assert.Equal(first.UserId, second.UserId);
        Assert.Equal(1, await w.Ctx.Users.CountAsync());
    }

    [Fact]
    public async Task InvalidToken_Throws()
    {
        using var w = AppDbContextWrap.New();
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            Handler(w, null).Handle(new AppleLoginCommand("bad"), default));
    }

    [Fact]
    public async Task LinksToExistingVerifiedEmailAccount_WhenIncomingEmailVerifiedRealEmail()
    {
        using var w = AppDbContextWrap.New();
        var existing = User.CreateWithGoogle("alice", "alice@me.com", "g-1"); // EmailVerified = true
        w.Ctx.Users.Add(existing);
        await w.Ctx.SaveChangesAsync();

        var res = await Handler(w, new AppleUserInfo("apple-sub-4", "alice@me.com", true, false))
            .Handle(new AppleLoginCommand("tok"), default);

        Assert.Equal(existing.Id, res.UserId);          // linked, not a new account
        Assert.Equal(1, await w.Ctx.Users.CountAsync());
        var user = await w.Ctx.Users.SingleAsync();
        Assert.Equal("apple-sub-4", user.AppleSubjectId);
    }
}

public class GoogleLoginTests
{
    private static GoogleLoginCommandHandler Handler(AppDbContextWrap w, GoogleUserInfo? info, bool allowLink = true) =>
        new(w.Ctx, TestInfra.Jwt(), new FakeGoogleAuth(info), new TestAuthPolicy(allowEmailLinking: allowLink), new NoopAbuseGuard());

    [Fact]
    public async Task NewUser_IsEmailVerified_WithGoogleId()
    {
        using var w = AppDbContextWrap.New();
        await Handler(w, new GoogleUserInfo("g-1", "new@me.com", "New")).Handle(new GoogleLoginCommand("tok"), default);
        var user = await w.Ctx.Users.SingleAsync();
        Assert.True(user.EmailVerified);
        Assert.Equal("g-1", user.GoogleId);
    }

    [Fact]
    public async Task LinksByEmail_AndMarksVerified()
    {
        using var w = AppDbContextWrap.New();
        var legacy = User.Create("bob", "bob@me.com", "hash"); // EmailVerified = false (legacy)
        w.Ctx.Users.Add(legacy);
        await w.Ctx.SaveChangesAsync();

        var res = await Handler(w, new GoogleUserInfo("g-2", "bob@me.com", "Bob")).Handle(new GoogleLoginCommand("tok"), default);

        Assert.Equal(legacy.Id, res.UserId);
        var user = await w.Ctx.Users.SingleAsync();
        Assert.Equal("g-2", user.GoogleId);
        Assert.True(user.EmailVerified);
    }

    [Fact]
    public async Task InvalidToken_Throws()
    {
        using var w = AppDbContextWrap.New();
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            Handler(w, null).Handle(new GoogleLoginCommand("bad"), default));
    }
}

public class RegisterGateTests
{
    private static RegisterCommandHandler Handler(AppDbContextWrap w, bool allowReg) =>
        new(w.Ctx, new PlainPasswordHasher(), TestInfra.Jwt(), new TestAuthPolicy(allowEmailRegistration: allowReg));

    [Fact]
    public async Task OpenRegistrationDisabled_Blocks()
    {
        using var w = AppDbContextWrap.New();
        await Assert.ThrowsAsync<BadRequestException>(() =>
            Handler(w, allowReg: false).Handle(new RegisterCommand("newbie", "n@me.com", "Password1"), default));
        Assert.Equal(0, await w.Ctx.Users.CountAsync());
    }

    [Fact]
    public async Task RegistrationEnabled_CreatesUser_NotEmailVerified()
    {
        using var w = AppDbContextWrap.New();
        await Handler(w, allowReg: true).Handle(new RegisterCommand("newbie", "n@me.com", "Password1"), default);
        var user = await w.Ctx.Users.SingleAsync();
        Assert.False(user.EmailVerified); // legacy email path is unverified
    }
}

public class JwtServiceTests
{
    [Fact]
    public void AccessToken_CarriesUserIdentityClaims()
    {
        var user = User.CreateWithGoogle("zoe", "zoe@me.com", "g-9");
        var token = TestInfra.Jwt().GenerateAccessToken(user);
        var claims = new JwtSecurityTokenHandler().ReadJwtToken(token).Claims.ToList();
        Assert.Contains(claims, c => c.Value == user.Id.ToString());
        Assert.Contains(claims, c => c.Value == "zoe@me.com");
    }

    [Fact]
    public void RefreshToken_HashIsDeterministicAndMatches()
    {
        var jwt = TestInfra.Jwt();
        var (token, hash, expires) = jwt.GenerateRefreshToken();
        Assert.Equal(hash, jwt.HashToken(token));
        Assert.True(expires > DateTime.UtcNow);
    }
}

public class RefreshTokenTests
{
    private static RefreshTokenCommandHandler Handler(AppDbContextWrap w) => new(w.Ctx, TestInfra.Jwt());

    [Fact]
    public async Task ValidToken_RotatesAndRevokesOld()
    {
        using var w = AppDbContextWrap.New();
        var jwt = TestInfra.Jwt();
        var user = User.CreateWithGoogle("rot", "rot@me.com", "g-r");
        w.Ctx.Users.Add(user);
        var (plain, hash, exp) = jwt.GenerateRefreshToken();
        w.Ctx.RefreshTokens.Add(RefreshToken.Create(user.Id, hash, exp));
        await w.Ctx.SaveChangesAsync();

        var res = await Handler(w).Handle(new RefreshTokenCommand(plain), default);

        Assert.False(string.IsNullOrEmpty(res.RefreshToken));
        var old = await w.Ctx.RefreshTokens.FirstAsync(t => t.TokenHash == hash);
        Assert.True(old.IsRevoked);
        Assert.Equal(2, await w.Ctx.RefreshTokens.CountAsync()); // old + new
    }

    [Fact]
    public async Task ReuseOfRevokedToken_RevokesFamily_AndThrows()
    {
        using var w = AppDbContextWrap.New();
        var jwt = TestInfra.Jwt();
        var user = User.CreateWithGoogle("fam", "fam@me.com", "g-f");
        w.Ctx.Users.Add(user);
        var (plain, hash, exp) = jwt.GenerateRefreshToken();
        var revoked = RefreshToken.Create(user.Id, hash, exp);
        revoked.Revoke();
        w.Ctx.RefreshTokens.Add(revoked);
        var (_, hash2, exp2) = jwt.GenerateRefreshToken();
        w.Ctx.RefreshTokens.Add(RefreshToken.Create(user.Id, hash2, exp2)); // active sibling
        await w.Ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            Handler(w).Handle(new RefreshTokenCommand(plain), default));

        Assert.False(await w.Ctx.RefreshTokens.AnyAsync(t => !t.IsRevoked)); // whole family revoked
    }
}

public class ChangePasswordTests
{
    private static ChangePasswordCommandHandler Handler(AppDbContextWrap w, Guid userId) =>
        new(w.Ctx, new TestCurrentUser(userId), new PlainPasswordHasher());

    [Fact]
    public async Task ValidChange_UpdatesHash_AndRevokesActiveRefreshTokens()
    {
        using var w = AppDbContextWrap.New();
        var jwt = TestInfra.Jwt();
        var user = User.Create("ann", "ann@me.com", "hash:OldPass1"); // PlainPasswordHasher format
        w.Ctx.Users.Add(user);
        var (_, h1, e1) = jwt.GenerateRefreshToken();
        var (_, h2, e2) = jwt.GenerateRefreshToken();
        w.Ctx.RefreshTokens.Add(RefreshToken.Create(user.Id, h1, e1));
        w.Ctx.RefreshTokens.Add(RefreshToken.Create(user.Id, h2, e2));
        await w.Ctx.SaveChangesAsync();

        await Handler(w, user.Id).Handle(new ChangePasswordCommand("OldPass1", "NewPass1"), default);

        var updated = await w.Ctx.Users.SingleAsync();
        Assert.True(new PlainPasswordHasher().Verify("NewPass1", updated.PasswordHash));
        Assert.False(await w.Ctx.RefreshTokens.AnyAsync(t => !t.IsRevoked)); // all sessions invalidated
    }

    [Fact]
    public async Task WrongCurrentPassword_Throws_AndDoesNotRevoke()
    {
        using var w = AppDbContextWrap.New();
        var jwt = TestInfra.Jwt();
        var user = User.Create("bob", "bob@me.com", "hash:OldPass1");
        w.Ctx.Users.Add(user);
        var (_, h1, e1) = jwt.GenerateRefreshToken();
        w.Ctx.RefreshTokens.Add(RefreshToken.Create(user.Id, h1, e1));
        await w.Ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            Handler(w, user.Id).Handle(new ChangePasswordCommand("WrongPass", "NewPass1"), default));

        Assert.True(await w.Ctx.RefreshTokens.AnyAsync(t => !t.IsRevoked)); // untouched
    }
}

/// <summary>Disposable wrapper so each test gets an isolated in-memory context.</summary>
internal sealed class AppDbContextWrap : IDisposable
{
    public PokerApp.Infrastructure.Persistence.AppDbContext Ctx { get; }
    private AppDbContextWrap(PokerApp.Infrastructure.Persistence.AppDbContext ctx) => Ctx = ctx;
    public static AppDbContextWrap New() => new(TestInfra.NewContext());
    public void Dispose() => Ctx.Dispose();
}
