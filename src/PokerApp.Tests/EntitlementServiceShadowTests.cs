using System;
using System.Threading.Tasks;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

public class EntitlementServiceShadowTests
{
    [Fact]
    public async Task An_active_sub_is_not_shadowed_by_a_refunded_sub_with_a_later_period_end()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();

        // Genuinely active now (ends in 10 days).
        ctx.Subscriptions.Add(Subscription.Create(uid, SubscriptionStore.Stripe, "price_monthly", "sub_active",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(10), true, false, DateTime.UtcNow));

        // Refunded but with a FAR-FUTURE period end (e.g. an annual sub refunded mid-term).
        var refunded = Subscription.Create(uid, SubscriptionStore.Stripe, "price_yearly", "sub_refunded",
            DateTime.UtcNow.AddDays(-2), DateTime.UtcNow.AddDays(300), true, false, DateTime.UtcNow.AddDays(-2));
        refunded.MarkRefunded(DateTime.UtcNow.AddDays(-1)); // status=Refunded, but CurrentPeriodEnd stays +300d
        ctx.Subscriptions.Add(refunded);
        await ctx.SaveChangesAsync();

        var ent = await new EntitlementService(ctx).GetAsync(uid);

        Assert.True(ent.IsPremium); // FAILS today: refunded (later period end) is selected first, then fails the active check
        Assert.Equal("price_monthly", ent.ProductId);
    }

    [Fact]
    public async Task Returns_free_when_only_an_expired_sub_exists()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        ctx.Subscriptions.Add(Subscription.Create(uid, SubscriptionStore.Stripe, "price_monthly", "sub_old",
            DateTime.UtcNow.AddDays(-40), DateTime.UtcNow.AddDays(-10), true, false, DateTime.UtcNow.AddDays(-40)));
        await ctx.SaveChangesAsync();

        Assert.False((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);
    }
}
