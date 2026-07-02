using PokerApp.Domain.Enums;

namespace PokerApp.Application.Common.Interfaces;

/// <summary>A subscription state validated with the store (never trusted from the client).</summary>
/// <remarks>
/// <paramref name="AppUserId"/> is the store-recorded owner of the transaction (Paddle
/// <c>custom_data.app_user_id</c>, set at checkout). When present it MUST equal the authenticated caller
/// before a grant — otherwise a leaked transaction id (Paddle exposes it in the <c>?_ptxn=</c> redirect URL)
/// would let another account claim the subscription. Null for stores whose token is itself a private,
/// account-bound receipt (Apple/Google/RevenueCat), where no separate binding check is needed.
/// </remarks>
public sealed record VerifiedSubscription(
    SubscriptionStore Store,
    string ProductId,
    string OriginalTransactionId,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    bool AutoRenew,
    bool IsSandbox,
    SubscriptionStatus Status,
    string? AppUserId = null);

/// <summary>
/// Vendor-agnostic receipt verifier (Apple/Google/RevenueCat behind this seam). B2 ships a mock;
/// a real verifier validates with the store. Returns null when the receipt is invalid (fail-closed).
/// </summary>
public interface IBillingVerifier
{
    Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default);
}
