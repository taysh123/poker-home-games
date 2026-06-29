using PokerApp.Domain.Enums;

namespace PokerApp.Application.Common.Interfaces;

/// <summary>Authoritative subscription state fetched from the Google Play Developer API.</summary>
public sealed record GooglePlaySubscriptionState(
    string ProductId, DateTime PeriodStart, DateTime PeriodEnd, bool AutoRenew, bool IsSandbox, SubscriptionStatus Status);

/// <summary>
/// Seam over the Google Play Developer API (purchases.subscriptionsv2.get). Credential-bound —
/// the real implementation is wired at deploy (service account). Fakeable for tests; fail-closed
/// (returns null) when unavailable.
/// </summary>
public interface IGooglePlaySubscriptionsClient
{
    Task<GooglePlaySubscriptionState?> GetAsync(string purchaseToken, CancellationToken ct = default);
}
