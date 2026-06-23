namespace PokerApp.Application.Common;

/// <summary>
/// Pure HTTP security-header policy (no ASP.NET dependency, so it is unit-testable). The API middleware applies
/// these to every response — belt-and-suspenders alongside Railway's TLS edge. CSP ships REPORT-ONLY first so
/// the Vercel SPA isn't broken while a strict policy is tuned; HSTS is production-only.
/// </summary>
public static class SecurityHeaderPolicy
{
    public static IReadOnlyList<KeyValuePair<string, string>> Headers(bool isProduction)
    {
        var headers = new List<KeyValuePair<string, string>>
        {
            new("X-Content-Type-Options", "nosniff"),
            new("X-Frame-Options", "DENY"),                                   // clickjacking
            new("Referrer-Policy", "strict-origin-when-cross-origin"),
            new("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"),
            new("Content-Security-Policy-Report-Only", "default-src 'self'; frame-ancestors 'none'"),
        };
        if (isProduction)
            headers.Add(new("Strict-Transport-Security", "max-age=31536000; includeSubDomains"));
        return headers;
    }
}
