using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;

namespace PokerApp.Infrastructure.Services;

/// <summary>Computes the current entitlement from the newest valid subscription. Fail-closed → free.</summary>
/// <remarks>
/// <paramref name="billing"/> is injected by DI (registered singleton); it is optional only so tests can
/// construct the service without it. When absent it FAILS CLOSED (sandbox subs grant nothing) — tests that
/// exercise sandbox grants pass <c>new BillingSettings { AcceptSandbox = true }</c> explicitly.
/// </remarks>
public sealed class EntitlementService(IApplicationDbContext db, BillingSettings? billing = null) : IEntitlementService
{
    public async Task<EntitlementDto> GetAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var acceptSandbox = billing?.AcceptSandbox ?? false; // null (tests) ⇒ FAIL CLOSED; sandbox acceptance is explicit opt-in

        // Consider ONLY subscriptions that grant premium right now (status allows it AND the period has not
        // ended), then take the latest-ending — so a refunded/expired sub with a far-future CurrentPeriodEnd can
        // never shadow a genuinely active one. The predicate mirrors Subscription.IsPremiumActive exactly
        // (Active/Grace/Canceled still grant until period end; Refunded/Expired never do). Fail-closed on sandbox:
        // a sandbox/mock-minted subscription grants nothing in production (audit H4) unless AcceptSandbox is set.
        var sub = await db.Subscriptions
            .AsNoTracking()
            .Where(s => s.UserId == userId
                && now <= s.CurrentPeriodEnd
                && (acceptSandbox || !s.IsSandbox)
                && (s.Status == SubscriptionStatus.Active
                    || s.Status == SubscriptionStatus.Grace
                    || s.Status == SubscriptionStatus.Canceled))
            .OrderByDescending(s => s.CurrentPeriodEnd)
            .FirstOrDefaultAsync(ct);

        if (sub is not null)
            return new EntitlementDto("premium", sub.Status.ToString().ToLowerInvariant(), sub.ProductId, sub.CurrentPeriodEnd);

        return EntitlementDto.Free;
    }
}
