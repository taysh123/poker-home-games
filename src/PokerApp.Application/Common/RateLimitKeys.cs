namespace PokerApp.Application.Common;

/// <summary>
/// Partition keys for the ASP.NET rate limiters. Pure (no ASP.NET dependency) so the key-selection + fallback
/// logic is unit-testable; <c>Program.cs</c> extracts the client IP and the user-id claim from the HttpContext
/// and calls these to build a per-client (auth) / per-user (coach) partition instead of one global bucket.
///
/// A key is NEVER null or blank — a null partition key throws in the .NET partitioned rate limiter. When the
/// value can't be determined we fall back to a single shared <see cref="Unknown"/> bucket (fail-safe: those
/// callers share a limit rather than crashing or getting an unlimited free pass).
/// </summary>
public static class RateLimitKeys
{
    /// <summary>Shared fallback bucket when no client identity can be determined.</summary>
    public const string Unknown = "unknown";

    /// <summary>Per-client key for the auth limiters: the client IP, or the shared bucket when it's unknown.</summary>
    public static string ForClientIp(string? clientIp) =>
        string.IsNullOrWhiteSpace(clientIp) ? Unknown : clientIp;

    /// <summary>
    /// Per-user key for the coach limiter: the authenticated user id, falling back to the client IP for an
    /// unauthenticated caller (the endpoint is [Authorize], so that path is defense in depth).
    /// </summary>
    public static string ForUser(string? userId, string? clientIp) =>
        string.IsNullOrWhiteSpace(userId) ? ForClientIp(clientIp) : userId;
}
