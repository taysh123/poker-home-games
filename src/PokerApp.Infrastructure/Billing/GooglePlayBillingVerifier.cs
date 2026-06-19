using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Validates a Google Play purchaseToken via the Play Developer API client (stubbed until deploy).
/// Fail-closed: null client result ⇒ null.
/// </summary>
public sealed class GooglePlayBillingVerifier(IGooglePlaySubscriptionsClient client, BillingSettings billing) : IBillingVerifier
{
    public async Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
    {
        if (store != SubscriptionStore.Google) return null;
        var state = await client.GetAsync(token, ct);
        if (state is null) return null;
        if (state.IsSandbox && !billing.AcceptSandbox) return null;

        return new VerifiedSubscription(
            SubscriptionStore.Google, state.ProductId, token, state.PeriodStart, state.PeriodEnd,
            state.AutoRenew, state.IsSandbox, state.Status);
    }
}
