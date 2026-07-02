using System;
using System.Threading;
using System.Threading.Tasks;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Coach.Commands;
using PokerApp.Infrastructure.Identity;
using PokerApp.Infrastructure.Persistence;
using PokerApp.Infrastructure.Services;
using PokerApp.Infrastructure.Settings;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Audit H3: a client-controlled IdempotencyKey must not be a free pass to re-invoke the paid AI model.
/// Replaying one key with DIFFERENT request content used to short-circuit the ledger (Allowed, no credit
/// consumed) and re-run Anthropic — unlimited premium analyses for one credit. The effective ledger key is
/// now bound to the request content, so a different body consumes another credit; a genuine retry (same key
/// AND same content) still dedups.
/// </summary>
public class SecurityCoachIdempotencyTests
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

    private static AnalyzeHandCommand Cmd(string key, string heroHand) => new("manual", null, heroHand, "BTN", null, key);

    [Fact]
    public async Task ReplayingSameKeyWithDifferentContent_ConsumesAnotherCredit()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var provider = new MockCoachAiProvider();

        // Free user has exactly one credit; the first analysis spends it.
        await Handler(ctx, uid, provider).Handle(Cmd("dupe-key", "AKs"), default);

        // Replaying the SAME idempotency key with DIFFERENT content must require another credit → quota exceeded.
        await Assert.ThrowsAsync<QuotaExceededException>(() =>
            Handler(ctx, uid, provider).Handle(Cmd("dupe-key", "QhQd"), default));
    }

    [Fact]
    public async Task DifferentFieldSplitsThatConcatenateEqually_AreDistinctCharges()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var provider = new MockCoachAiProvider();

        // These two requests concatenate to the same string under a naive field-join, but are genuinely
        // different analyses — the effective key must distinguish them so the second still costs a credit.
        await Handler(ctx, uid, provider).Handle(new AnalyzeHandCommand("manual", null, "AKsBTN", "", null, "same"), default);
        await Assert.ThrowsAsync<QuotaExceededException>(() =>
            Handler(ctx, uid, provider).Handle(new AnalyzeHandCommand("manual", null, "AKs", "BTN", null, "same"), default));
    }

    [Fact]
    public async Task ReplayingSameKeyAndSameContent_StaysIdempotent()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var provider = new MockCoachAiProvider();

        await Handler(ctx, uid, provider).Handle(Cmd("retry-key", "AKs"), default);

        // A genuine retry (same key AND same content) is not a second charge — it still returns a result.
        var again = await Handler(ctx, uid, provider).Handle(Cmd("retry-key", "AKs"), default);
        Assert.NotNull(again);
    }
}
