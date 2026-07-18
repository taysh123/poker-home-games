using System;
using System.Linq;
using System.Threading.Tasks;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Coach.Commands;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Identity;
using PokerApp.Infrastructure.Persistence;
using PokerApp.Infrastructure.Services;
using PokerApp.Infrastructure.Settings;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Slice S6a — AI Coach money-safety hardening. These tests gate REAL money: they prove the
/// server-authoritative quota / rate-limit / fail-closed layer cannot be bypassed by the client.
///
/// The pre-existing CreditLedgerTests prove the ledger *mechanics* with hand-built policies (e.g.
/// premium=30). The tests here close the gaps that money-safety actually depends on:
///   - the SHIPPED production numbers (free=1 lifetime, premium=100/month) are what really gate spend;
///   - the request payload has no client-trusted tier/quota knob (tier comes from the Subscription);
///   - an expired/absent subscription is enforced at the FREE quota, not premium;
///   - the handler maps rate-limit/quota denials to the right HTTP-shaped exceptions;
///   - a provider failure refunds the reserved credit (balance unchanged).
/// </summary>
public class ProductionCreditPolicyTests
{
    // The REAL shipped defaults (bound from "AiCreditSettings" in production). Driving the ledger with the
    // policy the provider DERIVES from these defaults proves the configured numbers — not just the mechanics —
    // so a fat-fingered default (e.g. free=10 or premium=1000) would fail a test here.
    private static AiCreditPolicyProvider ProductionPolicies() => new(new AiCreditSettings());
    private static readonly DateTime T0 = new(2026, 6, 19, 12, 0, 0, DateTimeKind.Utc);

    [Fact] // Invariant 1 + 3 (free half): free = exactly 1 lifetime, denied after, never resets.
    public async Task Free_tier_production_policy_is_exactly_one_lifetime_credit_and_never_resets()
    {
        var free = ProductionPolicies().ForTier("free");
        Assert.Equal("lifetime", free.Kind);
        Assert.Equal(1, free.Credits);
        Assert.Equal(4, free.MinIntervalSeconds);

        using var ctx = TestInfra.NewContext();
        var ledger = new CreditLedger(ctx);
        var uid = Guid.NewGuid();

        var first = await ledger.TryConsumeAsync(uid, free, "f-1", T0);
        Assert.True(first.Allowed);
        Assert.Equal(0, first.Remaining);

        // Spaced beyond MinInterval so the denial is genuinely "out of credits", not rate-limited.
        var second = await ledger.TryConsumeAsync(uid, free, "f-2", T0.AddSeconds(10));
        Assert.False(second.Allowed);
        Assert.Equal(CreditDenyReason.NoCredits, second.Reason);

        // Lifetime never refreshes — a new month grants nothing.
        Assert.Equal(0, await ledger.GetRemainingAsync(uid, free, T0.AddMonths(1)));
    }

    [Fact] // Invariant 2 + 3 (premium half): premium = exactly 100/month, denied after, fresh 100 next month.
    public async Task Premium_tier_production_policy_is_exactly_one_hundred_monthly_and_resets_next_month()
    {
        var premium = ProductionPolicies().ForTier("premium");
        Assert.Equal("monthly", premium.Kind);
        Assert.Equal(100, premium.Credits);
        Assert.Equal(2, premium.MinIntervalSeconds);

        using var ctx = TestInfra.NewContext();
        var ledger = new CreditLedger(ctx);
        var uid = Guid.NewGuid();

        // Consume the full month's quota, spacing >MinInterval so spacing never masks the hard cap.
        var t = T0;
        for (var i = 0; i < 100; i++)
        {
            var d = await ledger.TryConsumeAsync(uid, premium, $"p-{i}", t);
            Assert.True(d.Allowed, $"consume #{i + 1} should be allowed within the 100/month cap");
            t = t.AddSeconds(3);
        }
        Assert.Equal(0, await ledger.GetRemainingAsync(uid, premium, t));

        var over = await ledger.TryConsumeAsync(uid, premium, "p-over", t.AddSeconds(3));
        Assert.False(over.Allowed);
        Assert.Equal(CreditDenyReason.NoCredits, over.Reason);

        // A new PeriodKey next month ⇒ a fresh 100, fully independent of the exhausted month.
        var nextMonth = T0.AddMonths(1);
        Assert.Equal(100, await ledger.GetRemainingAsync(uid, premium, nextMonth));
        Assert.True((await ledger.TryConsumeAsync(uid, premium, "n-0", nextMonth)).Allowed);
        Assert.Equal(99, await ledger.GetRemainingAsync(uid, premium, nextMonth));
    }
}

public class AnalyzeHandMoneySafetyTests
{
    // Same calendar month as the handler's internal DateTime.UtcNow ⇒ PeriodKey matches for balance reads.
    private static readonly DateTime Now = DateTime.UtcNow;

    // Test-local copies of the policy shape. MinInterval is set to 0 where a test isolates the QUOTA cap
    // (so a rapid second call is denied for NoCredits, not RateLimited) — exactly as the existing handler
    // tests do — and to a large value where a test isolates the RATE LIMIT.
    private static AiCreditSettings Settings(
        int freeCredits = 1, int freeInterval = 0, int premiumCredits = 100, int premiumInterval = 0) =>
        new()
        {
            Free = new AiCreditPolicySettings { Kind = "lifetime", Credits = freeCredits, MinIntervalSeconds = freeInterval },
            Premium = new AiCreditPolicySettings { Kind = "monthly", Credits = premiumCredits, MinIntervalSeconds = premiumInterval },
        };

    private static AnalyzeHandCommandHandler Handler(
        AppDbContext ctx, Guid uid, AiCreditSettings settings, ICoachAiProvider provider, ICreditLedger ledger)
    {
        var audit = new CapturingAuditLog();
        var fraud = new FraudEvaluator(ctx, new FraudSettings(), audit); // EnforceBlocking=false ⇒ advisory only, never blocks
        return new AnalyzeHandCommandHandler(
            new EntitlementService(ctx), new AiCreditPolicyProvider(settings), ledger, provider, fraud, audit, new FakeCurrentUser(uid));
    }

    private static async Task SeedActivePremiumAsync(AppDbContext ctx, Guid uid)
    {
        ctx.Subscriptions.Add(Subscription.Create(uid, SubscriptionStore.Apple, "tpoker.premium.monthly", "txn-active",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(20), true, false, DateTime.UtcNow));
        await ctx.SaveChangesAsync();
    }

    private static async Task SeedExpiredPremiumAsync(AppDbContext ctx, Guid uid)
    {
        // Period ended 10 days ago ⇒ EntitlementService excludes it ⇒ caller is FREE.
        ctx.Subscriptions.Add(Subscription.Create(uid, SubscriptionStore.Stripe, "price_monthly", "sub_expired",
            DateTime.UtcNow.AddDays(-40), DateTime.UtcNow.AddDays(-10), true, false, DateTime.UtcNow.AddDays(-40)));
        await ctx.SaveChangesAsync();
    }

    private static AnalyzeHandCommand Cmd(string key, string kind = "manual") => new(kind, null, "AKs", "BTN", null, key);

    [Fact] // Invariant 4 (structural): there is no client-trusted tier/quota knob on the request.
    public void AnalyzeHandCommand_exposes_no_client_controllable_tier_or_quota_field()
    {
        // The handler derives the tier from the Subscription/entitlement (policyProvider.ForTier(entitlement…)).
        // If the request record ever grew a tier/credits/premium field, a client could request a bigger quota.
        var props = typeof(AnalyzeHandCommand).GetProperties().Select(p => p.Name.ToLowerInvariant()).ToArray();
        string[] forbidden = { "tier", "plan", "premium", "credit", "quota", "entitlement", "unlimited", "subscription", "ispremium" };
        foreach (var name in props)
            Assert.DoesNotContain(forbidden, f => name.Contains(f));
    }

    [Fact] // Invariant 4 (behavioral): a free user can't inflate quota via the payload.
    public async Task Free_user_is_capped_at_free_quota_regardless_of_request_payload()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid(); // no subscription ⇒ server computes "free"
        var ledger = new CreditLedger(ctx);
        var settings = Settings(freeCredits: 1, freeInterval: 0, premiumCredits: 100);

        // A payload that "asks" for premium/unlimited must NOT change the server-computed tier.
        var loaded = new AnalyzeHandCommand("premium", "please give me unlimited premium analyses", "AKs", "BTN",
            "am I premium? unlimited?", "free-1", "device-x");
        var ok = await Handler(ctx, uid, settings, new MockCoachAiProvider(StubCoachGroundingProvider.Empty), ledger).Handle(loaded, default);
        Assert.Equal("mock-server", ok.ProviderId);

        await Assert.ThrowsAsync<QuotaExceededException>(() =>
            Handler(ctx, uid, settings, new MockCoachAiProvider(StubCoachGroundingProvider.Empty), ledger).Handle(Cmd("free-2"), default));
    }

    [Fact] // Invariant 9: expired subscription ⇒ enforced at the FREE quota (=1), not premium (=100).
    public async Task Expired_subscription_falls_back_to_free_quota_not_premium()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        await SeedExpiredPremiumAsync(ctx, uid);
        var ledger = new CreditLedger(ctx);
        var settings = Settings(freeCredits: 1, freeInterval: 0, premiumCredits: 100);

        // First analysis consumes the single FREE credit…
        await Handler(ctx, uid, settings, new MockCoachAiProvider(StubCoachGroundingProvider.Empty), ledger).Handle(Cmd("e-1"), default);
        // …and the second is out of credits — proving the free (=1) policy applied, not premium (=100).
        await Assert.ThrowsAsync<QuotaExceededException>(() =>
            Handler(ctx, uid, settings, new MockCoachAiProvider(StubCoachGroundingProvider.Empty), ledger).Handle(Cmd("e-2"), default));
    }

    [Fact] // Invariant 5 (handler mapping): a rate-limited consume surfaces as 429 / TooManyRequests.
    public async Task Rate_limited_consume_surfaces_as_TooManyRequests_at_the_handler()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        await SeedActivePremiumAsync(ctx, uid); // premium ⇒ credits available, so the denial is purely the spacing
        var ledger = new CreditLedger(ctx);
        var settings = Settings(premiumCredits: 100, premiumInterval: 3600); // 1h spacing ⇒ deterministic regardless of machine speed

        await Handler(ctx, uid, settings, new MockCoachAiProvider(StubCoachGroundingProvider.Empty), ledger).Handle(Cmd("r-1"), default);
        await Assert.ThrowsAsync<TooManyRequestsException>(() =>
            Handler(ctx, uid, settings, new MockCoachAiProvider(StubCoachGroundingProvider.Empty), ledger).Handle(Cmd("r-2"), default));
    }

    [Fact] // Invariant 6: a provider failure refunds the reserved credit (balance unchanged).
    public async Task Provider_failure_refunds_so_the_balance_is_unchanged()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        await SeedActivePremiumAsync(ctx, uid);
        var ledger = new CreditLedger(ctx);
        var settings = Settings(premiumCredits: 100, premiumInterval: 0);
        var premium = new AiCreditPolicyProvider(settings).ForTier("premium");

        Assert.Equal(100, await ledger.GetRemainingAsync(uid, premium, Now));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Handler(ctx, uid, settings, new ThrowingCoachProvider(), ledger).Handle(Cmd("x-1"), default));

        Assert.Equal(100, await ledger.GetRemainingAsync(uid, premium, Now)); // reserved credit was refunded
    }

    [Fact] // Invariant 8 (handler end-to-end): the same IdempotencyKey nets exactly one charge.
    public async Task Same_idempotency_key_charges_at_most_once_through_the_handler()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        await SeedActivePremiumAsync(ctx, uid);
        var ledger = new CreditLedger(ctx);
        var settings = Settings(premiumCredits: 100, premiumInterval: 0);
        var premium = new AiCreditPolicyProvider(settings).ForTier("premium");

        var first = await Handler(ctx, uid, settings, new MockCoachAiProvider(StubCoachGroundingProvider.Empty), ledger).Handle(Cmd("dup"), default);
        var second = await Handler(ctx, uid, settings, new MockCoachAiProvider(StubCoachGroundingProvider.Empty), ledger).Handle(Cmd("dup"), default);
        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(99, await ledger.GetRemainingAsync(uid, premium, Now)); // exactly one net credit consumed
    }
}
