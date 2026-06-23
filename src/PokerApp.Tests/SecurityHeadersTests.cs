using System.Linq;
using PokerApp.Application.Common;
using Xunit;

public class SecurityHeadersTests
{
    [Fact]
    public void Includes_the_core_defensive_headers()
    {
        var h = SecurityHeaderPolicy.Headers(isProduction: false).ToDictionary(x => x.Key, x => x.Value);
        Assert.Equal("nosniff", h["X-Content-Type-Options"]);
        Assert.Equal("DENY", h["X-Frame-Options"]);
        Assert.True(h.ContainsKey("Referrer-Policy"));
        Assert.True(h.ContainsKey("Permissions-Policy"));
        Assert.Contains("frame-ancestors 'none'", h["Content-Security-Policy-Report-Only"]);
    }

    [Fact]
    public void Csp_is_report_only_first_not_enforcing()
    {
        var keys = SecurityHeaderPolicy.Headers(isProduction: true).Select(x => x.Key).ToList();
        Assert.Contains("Content-Security-Policy-Report-Only", keys);
        Assert.DoesNotContain("Content-Security-Policy", keys); // not enforcing yet (SPA-safe)
    }

    [Fact]
    public void Hsts_only_in_production()
    {
        Assert.DoesNotContain(SecurityHeaderPolicy.Headers(false), x => x.Key == "Strict-Transport-Security");
        Assert.Contains(SecurityHeaderPolicy.Headers(true), x => x.Key == "Strict-Transport-Security");
    }
}
