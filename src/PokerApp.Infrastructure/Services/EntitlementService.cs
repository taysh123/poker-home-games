using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>Computes the current entitlement from the newest valid subscription. Fail-closed → free.</summary>
public sealed class EntitlementService(IApplicationDbContext db) : IEntitlementService
{
    public async Task<EntitlementDto> GetAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var sub = await db.Subscriptions
            .AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.CurrentPeriodEnd)
            .FirstOrDefaultAsync(ct);

        if (sub is not null && sub.IsPremiumActive(now))
            return new EntitlementDto("premium", sub.Status.ToString().ToLowerInvariant(), sub.ProductId, sub.CurrentPeriodEnd);

        return EntitlementDto.Free;
    }
}
