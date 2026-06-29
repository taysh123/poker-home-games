using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Billing.Commands;
using PokerApp.Application.Features.Coach.Commands;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Identity;
using PokerApp.Infrastructure.Persistence;
using PokerApp.Infrastructure.Services;
using PokerApp.Infrastructure.Settings;
using Xunit;

namespace PokerApp.Tests;

internal sealed class FakeCurrentUser(Guid id) : ICurrentUserService
{
    public Guid UserId { get; } = id;
    public string? Email => "u@t.test";
    public string? Username => "u";
    public bool IsAuthenticated => true;
}

internal sealed class ThrowingCoachProvider : ICoachAiProvider
{
    public string Id => "throwing";
    public Task<CoachAnalysisResult> AnalyzeAsync(CoachAnalysisInput input, CancellationToken ct = default)
        => throw new InvalidOperationException("provider down");
}

public class EntitlementServiceTests
{
    [Fact]
    public async Task NoSubscription_IsFree()
    {
        using var ctx = TestInfra.NewContext();
        var e = await new EntitlementService(ctx).GetAsync(Guid.NewGuid());
        Assert.False(e.IsPremium);
        Assert.Equal("free", e.Plan);
    }

    [Fact]
    public async Task ActiveSubscription_IsPremium_RefundedOrExpired_IsFree()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var sub = Subscription.Create(uid, SubscriptionStore.Apple, "tpoker.premium.monthly", "txn-1",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(20), true, true, DateTime.UtcNow);
        ctx.Subscriptions.Add(sub);
        await ctx.SaveChangesAsync();
        Assert.True((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);

        sub.MarkRefunded(DateTime.UtcNow.AddMinutes(1));
        await ctx.SaveChangesAsync();
        Assert.False((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);
    }
}

public class CreditLedgerTests
{
    private static readonly AiCreditPolicy Free = new("lifetime", 1, 0);
    private static readonly AiCreditPolicy Premium = new("monthly", 30, 0);
    private static readonly DateTime T0 = new(2026, 6, 19, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task FreeLifetime_AllowsExactlyOne_ThenFailsClosed()
    {
        using var ctx = TestInfra.NewContext();
        var ledger = new CreditLedger(ctx);
        var uid = Guid.NewGuid();

        var first = await ledger.TryConsumeAsync(uid, Free, "req-1", T0);
        Assert.True(first.Allowed);
        Assert.Equal(0, first.Remaining);

        var second = await ledger.TryConsumeAsync(uid, Free, "req-2", T0.AddMinutes(5));
        Assert.False(second.Allowed);
        Assert.Equal(CreditDenyReason.NoCredits, second.Reason);
    }

    [Fact]
    public async Task Lifetime_NeverResetsAcrossMonths()
    {
        using var ctx = TestInfra.NewContext();
        var ledger = new CreditLedger(ctx);
        var uid = Guid.NewGuid();
        await ledger.TryConsumeAsync(uid, Free, "req-1", T0);
        var nextMonth = T0.AddMonths(1);
        Assert.Equal(0, await ledger.GetRemainingAsync(uid, Free, nextMonth));
    }

    [Fact]
    public async Task Idempotency_SameKey_DoesNotDoubleCharge()
    {
        using var ctx = TestInfra.NewContext();
        var ledger = new CreditLedger(ctx);
        var uid = Guid.NewGuid();
        await ledger.TryConsumeAsync(uid, Premium, "same", T0);
        var again = await ledger.TryConsumeAsync(uid, Premium, "same", T0);
        Assert.True(again.Allowed);
        Assert.Equal(29, await ledger.GetRemainingAsync(uid, Premium, T0)); // only one consumed
    }

    [Fact]
    public async Task PremiumMonthly_CapsAtQuota_ResetsNextMonth()
    {
        using var ctx = TestInfra.NewContext();
        var ledger = new CreditLedger(ctx);
        var uid = Guid.NewGuid();
        for (var i = 0; i < 30; i++)
            Assert.True((await ledger.TryConsumeAsync(uid, Premium, $"m-{i}", T0)).Allowed);
        Assert.False((await ledger.TryConsumeAsync(uid, Premium, "m-30", T0)).Allowed);

        var nextMonth = T0.AddMonths(1);
        Assert.Equal(30, await ledger.GetRemainingAsync(uid, Premium, nextMonth));
        Assert.True((await ledger.TryConsumeAsync(uid, Premium, "n-0", nextMonth)).Allowed);
    }

    [Fact]
    public async Task RateLimit_BlocksWithinInterval()
    {
        using var ctx = TestInfra.NewContext();
        var ledger = new CreditLedger(ctx);
        var policy = new AiCreditPolicy("monthly", 30, 60);
        var uid = Guid.NewGuid();
        await ledger.TryConsumeAsync(uid, policy, "a", T0);
        var blocked = await ledger.TryConsumeAsync(uid, policy, "b", T0.AddSeconds(5));
        Assert.False(blocked.Allowed);
        Assert.Equal(CreditDenyReason.RateLimited, blocked.Reason);
    }

    [Fact]
    public async Task Refund_RestoresBalance()
    {
        using var ctx = TestInfra.NewContext();
        var ledger = new CreditLedger(ctx);
        var uid = Guid.NewGuid();
        await ledger.TryConsumeAsync(uid, Premium, "c1", T0);
        Assert.Equal(29, await ledger.GetRemainingAsync(uid, Premium, T0));
        await ledger.RefundAsync(uid, "c1", T0);
        Assert.Equal(30, await ledger.GetRemainingAsync(uid, Premium, T0));
    }
}

public class AnalyzeHandTests
{
    private static AiCreditPolicyProvider Policies() =>
        new(new AiCreditSettings
        {
            Free = new AiCreditPolicySettings { Kind = "lifetime", Credits = 1, MinIntervalSeconds = 0 },
            Premium = new AiCreditPolicySettings { Kind = "monthly", Credits = 30, MinIntervalSeconds = 0 },
        });

    private static AnalyzeHandCommandHandler Handler(AppDbContext ctx, Guid uid, ICoachAiProvider provider)
    {
        var audit = new CapturingAuditLog();
        var fraud = new FraudEvaluator(ctx, new FraudSettings(), audit);
        return new(new EntitlementService(ctx), Policies(), new CreditLedger(ctx), provider, fraud, audit, new FakeCurrentUser(uid));
    }

    private static AnalyzeHandCommand Cmd(string key) => new("manual", null, "AKs", "BTN", null, key);

    [Fact]
    public async Task FreeUser_FirstAnalysisSucceeds_SecondIsQuotaExceeded()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var provider = new MockCoachAiProvider();

        var result = await Handler(ctx, uid, provider).Handle(Cmd("k1"), default);
        Assert.Equal("mock-server", result.ProviderId);

        await Assert.ThrowsAsync<QuotaExceededException>(() =>
            Handler(ctx, uid, provider).Handle(Cmd("k2"), default));
    }

    [Fact]
    public async Task ProviderFailure_RefundsCredit()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Handler(ctx, uid, new ThrowingCoachProvider()).Handle(Cmd("k1"), default));

        // Credit was refunded → a real analysis still works afterward.
        var ok = await Handler(ctx, uid, new MockCoachAiProvider()).Handle(Cmd("k2"), default);
        Assert.NotNull(ok);
    }
}

public class BillingFlowTests
{
    [Fact]
    public async Task ValidatePurchase_CreatesSubscription_GrantsPremium()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var handler = new ValidatePurchaseCommandHandler(
            new MockBillingVerifier(), ctx, new EntitlementService(ctx), new CapturingAuditLog(), new FakeCurrentUser(uid));

        var ent = await handler.Handle(new ValidatePurchaseCommand("apple", "receipt-xyz"), default);
        Assert.True(ent.IsPremium);
        Assert.Equal(1, await ctx.Subscriptions.CountAsync());
    }

    [Fact]
    public async Task Webhook_Refund_RevokesPremium_AndIsIdempotent()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        ctx.Subscriptions.Add(Subscription.Create(uid, SubscriptionStore.Apple, "p", "txn-9",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(20), true, true, DateTime.UtcNow));
        await ctx.SaveChangesAsync();

        var handler = new ProcessStoreNotificationCommandHandler(ctx, new CapturingAuditLog());
        var notif = new StoreNotificationDto("uuid-1", "refund", "txn-9", DateTime.UtcNow.AddMinutes(1), null);

        await handler.Handle(new ProcessStoreNotificationCommand("apple", notif), default);
        Assert.False((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);

        await handler.Handle(new ProcessStoreNotificationCommand("apple", notif), default); // replay
        Assert.Equal(1, await ctx.StoreWebhookEvents.CountAsync()); // deduped
    }
}
