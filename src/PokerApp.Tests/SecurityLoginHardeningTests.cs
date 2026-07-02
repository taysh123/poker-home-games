using System;
using System.Threading.Tasks;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Features.Auth.Commands.Login;
using PokerApp.Domain.Entities;
using PokerApp.Infrastructure.Identity;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Audit M1: a password login against a Google/Apple-only account (empty PasswordHash) must return a normal
/// 401 (UnauthorizedException) — not let BCrypt throw on the empty hash, which surfaces as a 500 and forms a
/// user-enumeration oracle (a social account => 500; a non-existent email => 401). Uses the REAL BCrypt
/// PasswordHasher so the empty-hash throw is exercised (the fake hasher wouldn't reproduce it).
/// </summary>
public class SecurityLoginHardeningTests
{
    [Fact]
    public async Task PasswordLogin_AgainstSocialOnlyAccount_ReturnsUnauthorized_NotServerError()
    {
        using var w = AppDbContextWrap.New();
        var social = User.CreateWithGoogle("soc", "soc@me.com", "g-1"); // PasswordHash == string.Empty
        w.Ctx.Users.Add(social);
        await w.Ctx.SaveChangesAsync();

        var handler = new LoginCommandHandler(w.Ctx, new PasswordHasher(), TestInfra.Jwt());

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            handler.Handle(new LoginCommand("soc@me.com", "anything"), default));
    }

    [Fact]
    public async Task PasswordLogin_WithCorrectPassword_StillSucceeds()
    {
        using var w = AppDbContextWrap.New();
        var hasher = new PasswordHasher();
        var user = User.Create("pw", "pw@me.com", hasher.Hash("Password1")); // real bcrypt hash
        w.Ctx.Users.Add(user);
        await w.Ctx.SaveChangesAsync();

        var handler = new LoginCommandHandler(w.Ctx, hasher, TestInfra.Jwt());
        var res = await handler.Handle(new LoginCommand("pw@me.com", "Password1"), default);

        Assert.False(string.IsNullOrEmpty(res.AccessToken)); // real password login is unaffected by the guard
    }
}
