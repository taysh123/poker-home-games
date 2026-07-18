using System;
using System.Threading.Tasks;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Audit H4: sandbox/mock subscriptions must not grant premium in production. EntitlementService is the
/// chokepoint — it excludes IsSandbox subscriptions unless BillingSettings.AcceptSandbox is true (dev/test).
/// So even if a mock verifier ever minted a sandbox sub on a misconfigured prod deploy, it grants nothing.
/// </summary>
public class SecuritySandboxEntitlementTests
{
    private static Subscription Sub(Guid uid, bool isSandbox) => Subscription.Create(
        uid, SubscriptionStore.Paddle, "pri_monthly", "sub_x",
        DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(20), true, isSandbox, DateTime.UtcNow);

    [Fact]
    public async Task SandboxSub_DoesNotGrantPremium_WhenSandboxRejected()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        ctx.Subscriptions.Add(Sub(uid, isSandbox: true));
        await ctx.SaveChangesAsync();

        var ent = await new EntitlementService(ctx, new BillingSettings { AcceptSandbox = false }).GetAsync(uid);
        Assert.False(ent.IsPremium);
    }

    [Fact]
    public async Task SandboxSub_GrantsPremium_WhenSandboxAccepted()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        ctx.Subscriptions.Add(Sub(uid, isSandbox: true));
        await ctx.SaveChangesAsync();

        var ent = await new EntitlementService(ctx, new BillingSettings { AcceptSandbox = true }).GetAsync(uid);
        Assert.True(ent.IsPremium);
    }

    [Fact]
    public async Task ProductionSub_GrantsPremium_EvenWhenSandboxRejected()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        ctx.Subscriptions.Add(Sub(uid, isSandbox: false));
        await ctx.SaveChangesAsync();

        var ent = await new EntitlementService(ctx, new BillingSettings { AcceptSandbox = false }).GetAsync(uid);
        Assert.True(ent.IsPremium);
    }
}
