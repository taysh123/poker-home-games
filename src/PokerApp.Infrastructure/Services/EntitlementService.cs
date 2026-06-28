using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Services;

/// <summary>Computes the current entitlement from the newest valid subscription. Fail-closed → free.</summary>
public sealed class EntitlementService(IApplicationDbContext db) : IEntitlementService
{
    public async Task<EntitlementDto> GetAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        // Consider ONLY subscriptions that grant premium right now (status allows it AND the period has not
        // ended), then take the latest-ending — so a refunded/expired sub with a far-future CurrentPeriodEnd can
        // never shadow a genuinely active one. The predicate mirrors Subscription.IsPremiumActive exactly
        // (Active/Grace/Canceled still grant until period end; Refunded/Expired never do).
        var sub = await db.Subscriptions
            .AsNoTracking()
            .Where(s => s.UserId == userId
                && now <= s.CurrentPeriodEnd
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
