using System;
using PokerApp.Infrastructure.Identity;
using Xunit;

namespace PokerApp.Tests;

public class JwtKeyTests
{
    [Fact]
    public void Production_throws_on_missing_secret()
    {
        Assert.Throws<InvalidOperationException>(() => JwtKey.ResolveSigningKey(null, requireStrongSecret: true));
        Assert.Throws<InvalidOperationException>(() => JwtKey.ResolveSigningKey("", requireStrongSecret: true));
    }

    [Fact]
    public void Production_throws_on_short_secret()
    {
        Assert.Throws<InvalidOperationException>(() => JwtKey.ResolveSigningKey("too-short", requireStrongSecret: true));
    }

    [Fact]
    public void Production_accepts_a_sufficiently_long_secret()
    {
        var secret = new string('x', 64); // >= 32 bytes
        var key = JwtKey.ResolveSigningKey(secret, requireStrongSecret: true);
        Assert.NotNull(key);
        Assert.True(key.KeySize >= 256); // bits
    }

    [Fact]
    public void Development_pads_a_short_secret_instead_of_throwing()
    {
        var key = JwtKey.ResolveSigningKey("dev", requireStrongSecret: false);
        Assert.NotNull(key);
        Assert.True(key.KeySize >= 256); // padded to >= 32 bytes
    }

    [Fact]
    public void Exactly_minimum_length_secret_is_accepted_outside_development()
    {
        var secret = new string('y', JwtKey.MinSecretBytes); // exactly 32 ASCII bytes
        var key = JwtKey.ResolveSigningKey(secret, requireStrongSecret: true);
        Assert.Equal(256, key.KeySize);
    }
}
