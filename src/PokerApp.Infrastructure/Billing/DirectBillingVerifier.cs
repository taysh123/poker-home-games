using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Dispatches receipt verification to the per-store verifier (the "direct" provider path). Each verifier is
/// fail-closed: it returns null when its store doesn't match or its credentials are unconfigured — so an
/// unconfigured Stripe/RevenueCat simply yields null rather than granting anything.
/// </summary>
public sealed class DirectBillingVerifier(
    AppleBillingVerifier apple,
    GooglePlayBillingVerifier google,
    StripeBillingVerifier stripe,
    RevenueCatBillingVerifier revenueCat,
    PaddleBillingVerifier paddle) : IBillingVerifier
{
    public Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
        => store switch
        {
            SubscriptionStore.Apple => apple.VerifyAsync(store, token, ct),
            SubscriptionStore.Google => google.VerifyAsync(store, token, ct),
            SubscriptionStore.Stripe => stripe.VerifyAsync(store, token, ct),
            SubscriptionStore.RevenueCat => revenueCat.VerifyAsync(store, token, ct),
            SubscriptionStore.Paddle => paddle.VerifyAsync(store, token, ct),
            _ => Task.FromResult<VerifiedSubscription?>(null),
        };
}
