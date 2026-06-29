using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// B2 mock receipt verifier — lets the enforcement layer work end-to-end with no live billing.
/// A real verifier (Apple/Google/RevenueCat) replaces this behind IBillingVerifier. Fail-closed:
/// an empty token yields null. Mock receipts are always sandbox.
/// </summary>
public sealed class MockBillingVerifier : IBillingVerifier
{
    public Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token)) return Task.FromResult<VerifiedSubscription?>(null);
        var now = DateTime.UtcNow;
        var productId = "tpoker.premium.monthly";
        var result = new VerifiedSubscription(
            store, productId, OriginalTransactionId: token,
            PeriodStart: now, PeriodEnd: now.AddMonths(1),
            AutoRenew: true, IsSandbox: true, Status: SubscriptionStatus.Active);
        return Task.FromResult<VerifiedSubscription?>(result);
    }
}
