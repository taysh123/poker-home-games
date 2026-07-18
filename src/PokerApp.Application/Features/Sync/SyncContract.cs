using System.Text;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Sync;

/// <summary>
/// Single source of truth for the Cloud Sync guard rails so the GET and PUT handlers can never drift
/// apart: the premium gate, the namespace allow-list, and the payload size bound all live here.
/// </summary>
internal static class SyncContract
{
    /// <summary>Hard upper bound on a stored blob (1 MB of UTF-8). A larger payload is a client bug / abuse.</summary>
    public const int MaxPayloadBytes = 1024 * 1024;

    /// <summary>
    /// The ONLY namespaces a client may sync. Ordinal (case-sensitive) — these are exact client keys,
    /// not user-facing text. Anything else is rejected before it can reach storage.
    /// </summary>
    public static readonly IReadOnlySet<string> AllowedNamespaces =
        new HashSet<string>(StringComparer.Ordinal) { "localGames", "study", "coach" };

    /// <summary>Premium gate — server-authoritative. Free / expired / absent subscription ⇒ 403 Forbidden.</summary>
    public static async Task EnsurePremiumAsync(
        IEntitlementService entitlements, Guid userId, CancellationToken ct)
    {
        var entitlement = await entitlements.GetAsync(userId, ct);
        if (!entitlement.IsPremium)
            throw new UnauthorizedAccessException("Cloud Sync requires Premium.");
    }

    /// <summary>Reject any namespace outside the allow-list with a 400 (BadRequest).</summary>
    public static void ValidateNamespace(string? ns)
    {
        if (string.IsNullOrEmpty(ns) || !AllowedNamespaces.Contains(ns))
            throw new BadRequestException($"Unknown sync namespace '{ns}'.");
    }

    /// <summary>Reject a null or oversized payload with a 400 (BadRequest) before it can hit the DB.</summary>
    public static void ValidatePayload(string? payload)
    {
        if (payload is null)
            throw new BadRequestException("Payload is required.");
        if (Encoding.UTF8.GetByteCount(payload) > MaxPayloadBytes)
            throw new BadRequestException($"Payload exceeds the {MaxPayloadBytes} byte limit.");
    }
}
