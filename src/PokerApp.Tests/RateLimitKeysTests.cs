using PokerApp.Application.Common;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Audit H1/M2: the rate limiters must partition per client (auth) and per user (coach), not share one global
/// bucket. This pins the pure key-selection + fallback logic (Program.cs extracts the IP / user-id claim from
/// HttpContext and calls these). A null key must never be returned (that would crash the partitioned limiter).
/// </summary>
public class RateLimitKeysTests
{
    [Fact]
    public void ForClientIp_ReturnsTheIp_WhenPresent() =>
        Assert.Equal("203.0.113.7", RateLimitKeys.ForClientIp("203.0.113.7"));

    [Fact]
    public void ForClientIp_FallsBackToUnknown_WhenNullOrBlank()
    {
        Assert.Equal(RateLimitKeys.Unknown, RateLimitKeys.ForClientIp(null));
        Assert.Equal(RateLimitKeys.Unknown, RateLimitKeys.ForClientIp("   "));
    }

    [Fact]
    public void ForUser_ReturnsTheUserId_WhenAuthenticated() =>
        Assert.Equal("user-42", RateLimitKeys.ForUser("user-42", "203.0.113.7"));

    [Fact]
    public void ForUser_FallsBackToClientIp_WhenNoUser() =>
        Assert.Equal("203.0.113.7", RateLimitKeys.ForUser(null, "203.0.113.7"));

    [Fact]
    public void ForUser_FallsBackToUnknown_WhenNoUserAndNoIp() =>
        Assert.Equal(RateLimitKeys.Unknown, RateLimitKeys.ForUser("  ", null));

    [Fact]
    public void TwoDifferentClients_GetDifferentKeys() =>
        Assert.NotEqual(RateLimitKeys.ForClientIp("203.0.113.7"), RateLimitKeys.ForClientIp("198.51.100.9"));
}
