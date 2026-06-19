using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Billing;

/// <summary>Dispatches receipt verification to the per-store verifier (the "direct" provider path).</summary>
public sealed class DirectBillingVerifier(
    AppleBillingVerifier apple,
    GooglePlayBillingVerifier google) : IBillingVerifier
{
    public Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
        => store == SubscriptionStore.Apple ? apple.VerifyAsync(store, token, ct) : google.VerifyAsync(store, token, ct);
}
