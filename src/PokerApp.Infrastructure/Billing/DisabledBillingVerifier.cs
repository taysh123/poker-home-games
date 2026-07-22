using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Fail-closed verifier for Production when no real provider is configured: verifies nothing, so
/// POST /api/billing/validate can never mint a subscription. Replaces the mock (which grants premium
/// for ANY non-empty receipt) as the Production fallback.
/// </summary>
public sealed class DisabledBillingVerifier : IBillingVerifier
{
    public Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
        => Task.FromResult<VerifiedSubscription?>(null);
}
