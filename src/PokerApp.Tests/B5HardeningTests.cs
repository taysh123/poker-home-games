using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Billing.Commands.RedeemTopUp;
using PokerApp.Application.Features.Billing.Queries.GetTopUpBundles;
using PokerApp.Application.Features.Coach.Commands;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Identity;
using PokerApp.Infrastructure.Persistence;
using PokerApp.Infrastructure.Services;
using PokerApp.Infrastructure.Settings;
using Xunit;

namespace PokerApp.Tests;

public class FraudScoringTests
{
    private static FraudSettings Settings(bool enforce = false) => new()
    {
        EnforceBlocking = enforce,
        MaxAccountsPerDevice = 3,
        MaxAnalysesPerWindow = 10,
        BlockScore = 100,
        MultiAccountWeight = 60,
        VelocityWeight = 70,
    };

    [Fact]
    public void NoSignals_ScoreZero_NoBlock()
    {
        var a = FraudScoring.Evaluate(accountsOnDevice: 1, analysesInWindow: 2, Settings(enforce: true));
        Assert.Equal(0, a.Score);
        Assert.Empty(a.Signals);
        Assert.False(a.ShouldBlock);
    }

    [Fact]
    public void MultiAccount_OverThreshold_Signals()
    {
        var a = FraudScoring.Evaluate(accountsOnDevice: 4, analysesInWindow: 0, Settings());
        Assert.Contains(a.Signals, s => s.Code == "multi_account_device");
        Assert.Equal(60, a.Score);
    }

    [Fact]
    public void Velocity_OverThreshold_Signals()
    {
        var a = FraudScoring.Evaluate(accountsOnDevice: 0, analysesInWindow: 11, Settings());
        Assert.Contains(a.Signals, s => s.Code == "velocity_exceeded");
        Assert.Equal(70, a.Score);
    }

    [Fact]
    public void Combined_SumsWeights()
    {
        var a = FraudScoring.Evaluate(accountsOnDevice: 4, analysesInWindow: 11, Settings());
        Assert.Equal(130, a.Score);
        Assert.Equal(2, a.Signals.Count);
    }

    [Fact]
    public void ShouldBlock_OnlyWhenEnforcedAndOverBlockScore()
    {
        // Over the block score but enforcement off ⇒ advisory only.
        Assert.False(FraudScoring.Evaluate(4, 11, Settings(enforce: false)).ShouldBlock);
        // Enforcement on + score >= BlockScore ⇒ block.
        Assert.True(FraudScoring.Evaluate(4, 11, Settings(enforce: true)).ShouldBlock);
        // Enforcement on but below BlockScore ⇒ no block.
        Assert.False(FraudScoring.Evaluate(4, 0, Settings(enforce: true)).ShouldBlock);
    }
}

public class FraudEvaluatorTests
{
    [Fact]
    public async Task RecordDevice_CreatesThenTouches()
    {
        using var ctx = TestInfra.NewContext();
        var eval = new FraudEvaluator(ctx, new FraudSettings(), new CapturingAuditLog());
        var uid = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await eval.RecordDeviceAsync(uid, "dev-1", now);
        await eval.RecordDeviceAsync(uid, "dev-1", now.AddMinutes(1));

        var binding = await ctx.DeviceBindings.SingleAsync();
        Assert.Equal(2, binding.SeenCount);
    }

    [Fact]
    public async Task NullDeviceId_NoOp()
    {
        using var ctx = TestInfra.NewContext();
        var eval = new FraudEvaluator(ctx, new FraudSettings(), new CapturingAuditLog());
        await eval.RecordDeviceAsync(Guid.NewGuid(), null, DateTime.UtcNow);
        Assert.Equal(0, await ctx.DeviceBindings.CountAsync());
    }

    [Fact]
    public async Task SecondAccountOnDevice_IsAMultiAccountSignal()
    {
        using var ctx = TestInfra.NewContext();
        var settings = new FraudSettings { MaxAccountsPerDevice = 1, MultiAccountWeight = 60 };
        var audit = new CapturingAuditLog();
        var eval = new FraudEvaluator(ctx, settings, audit);
        var now = DateTime.UtcNow;

        await eval.RecordDeviceAsync(Guid.NewGuid(), "shared", now);
        var victim = Guid.NewGuid();
        await eval.RecordDeviceAsync(victim, "shared", now);

        var a = await eval.EvaluateAsync(victim, "shared", now);
        Assert.Contains(a.Signals, s => s.Code == "multi_account_device");
        Assert.True(audit.Has(AuditCategory.Fraud));
    }

    [Fact]
    public async Task Velocity_CountsRecentConsumes()
    {
        using var ctx = TestInfra.NewContext();
        var settings = new FraudSettings { VelocityWindowSeconds = 60, MaxAnalysesPerWindow = 2, VelocityWeight = 70 };
        var eval = new FraudEvaluator(ctx, settings, new CapturingAuditLog());
        var uid = Guid.NewGuid();
        var now = DateTime.UtcNow;

        for (var i = 0; i < 3; i++)
            ctx.CreditLedgerEntries.Add(CreditLedgerEntry.Create(uid, CreditEntryType.Consume, -1, "lifetime", "ai_analysis", $"c-{i}"));
        await ctx.SaveChangesAsync();

        var a = await eval.EvaluateAsync(uid, "dev", now);
        Assert.Contains(a.Signals, s => s.Code == "velocity_exceeded");
    }
}

public class TopUpTests
{
    private static AiCreditPolicyProvider Policies() => new(new AiCreditSettings
    {
        Free = new AiCreditPolicySettings { Kind = "lifetime", Credits = 1, MinIntervalSeconds = 0 },
        Premium = new AiCreditPolicySettings { Kind = "monthly", Credits = 30, MinIntervalSeconds = 0 },
    });

    private static TopUpCatalog EnabledCatalog() => new(new TopUpSettings
    {
        Enabled = true,
        Bundles = [new TopUpBundleSettings { ProductId = "tpoker.topup.10", Credits = 10 }],
    });

    private static RedeemTopUpCommandHandler Handler(AppDbContext ctx, Guid uid, ITopUpCatalog catalog, IAuditLog audit) =>
        new(catalog, new EntitlementService(ctx), Policies(), new CreditLedger(ctx), audit, new FakeCurrentUser(uid));

    [Fact]
    public void Catalog_FailsClosed_WhenDisabled()
    {
        var disabled = new TopUpCatalog(new TopUpSettings { Enabled = false, Bundles = [new TopUpBundleSettings { ProductId = "x", Credits = 5 }] });
        Assert.Null(disabled.Find("x"));
        Assert.False(disabled.Enabled);
    }

    [Fact]
    public async Task GetTopUpBundles_ReturnsConfig_WhenEnabled_ElseEmpty()
    {
        var enabled = await new GetTopUpBundlesQueryHandler(EnabledCatalog()).Handle(new GetTopUpBundlesQuery(), default);
        Assert.Single(enabled);
        var off = await new GetTopUpBundlesQueryHandler(new TopUpCatalog(new TopUpSettings())).Handle(new GetTopUpBundlesQuery(), default);
        Assert.Empty(off);
    }

    [Fact]
    public async Task Redeem_Disabled_FailsClosed()
    {
        using var ctx = TestInfra.NewContext();
        var handler = Handler(ctx, Guid.NewGuid(), new TopUpCatalog(new TopUpSettings()), new CapturingAuditLog());
        await Assert.ThrowsAsync<BadRequestException>(() =>
            handler.Handle(new RedeemTopUpCommand("apple", "tok", "tpoker.topup.10"), default));
    }

    [Fact]
    public async Task Redeem_UnknownProduct_FailsClosed()
    {
        using var ctx = TestInfra.NewContext();
        var handler = Handler(ctx, Guid.NewGuid(), EnabledCatalog(), new CapturingAuditLog());
        await Assert.ThrowsAsync<BadRequestException>(() =>
            handler.Handle(new RedeemTopUpCommand("apple", "tok", "bogus"), default));
    }

    [Fact]
    public async Task Redeem_Known_GrantsCredits_Idempotent_AndAudits()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var audit = new CapturingAuditLog();
        var handler = Handler(ctx, uid, EnabledCatalog(), audit);

        var first = await handler.Handle(new RedeemTopUpCommand("apple", "tok-1", "tpoker.topup.10"), default);
        Assert.Equal(10, first.CreditsAdded);
        Assert.Equal(11, first.Remaining); // free lifetime 1 + 10 top-up
        Assert.True(audit.Has(AuditCategory.CreditTopUp));

        // Same purchase token ⇒ idempotent (no double grant).
        var again = await handler.Handle(new RedeemTopUpCommand("apple", "tok-1", "tpoker.topup.10"), default);
        Assert.Equal(11, again.Remaining);
    }
}

public class AuditAndFraudWiringTests
{
    private static AiCreditPolicyProvider Policies() => new(new AiCreditSettings
    {
        Free = new AiCreditPolicySettings { Kind = "lifetime", Credits = 1, MinIntervalSeconds = 0 },
        Premium = new AiCreditPolicySettings { Kind = "monthly", Credits = 30, MinIntervalSeconds = 0 },
    });

    private static AnalyzeHandCommandHandler Handler(AppDbContext ctx, Guid uid, FraudSettings settings, CapturingAuditLog audit) =>
        new(new EntitlementService(ctx), Policies(), new CreditLedger(ctx), new MockCoachAiProvider(StubCoachGroundingProvider.Empty),
            new FraudEvaluator(ctx, settings, audit), audit, new FakeCurrentUser(uid));

    private static AnalyzeHandCommand Cmd(string key, string? device = null) =>
        new("manual", null, "AKs", "BTN", null, key, device);

    [Fact]
    public async Task Analyze_RecordsCreditSpendAndAiUsage()
    {
        using var ctx = TestInfra.NewContext();
        var audit = new CapturingAuditLog();
        await Handler(ctx, Guid.NewGuid(), new FraudSettings(), audit).Handle(Cmd("k1"), default);
        Assert.True(audit.Has(AuditCategory.CreditSpend));
        Assert.True(audit.Has(AuditCategory.AiUsage));
        Assert.True(audit.Has(AuditCategory.AiCost));
    }

    [Fact]
    public async Task Analyze_DefaultSettings_NeverBlocks()
    {
        using var ctx = TestInfra.NewContext();
        var result = await Handler(ctx, Guid.NewGuid(), new FraudSettings(), new CapturingAuditLog()).Handle(Cmd("k1", "dev"), default);
        Assert.NotNull(result);
    }

    [Fact]
    public async Task Analyze_Blocks_WhenEnforcedAndMultiAccountOverThreshold()
    {
        using var ctx = TestInfra.NewContext();
        var settings = new FraudSettings { EnforceBlocking = true, MaxAccountsPerDevice = 1, BlockScore = 50, MultiAccountWeight = 60 };
        var audit = new CapturingAuditLog();
        var now = DateTime.UtcNow;

        // Another account already on the same device.
        await new FraudEvaluator(ctx, settings, audit).RecordDeviceAsync(Guid.NewGuid(), "shared", now);

        var victim = Guid.NewGuid();
        await Assert.ThrowsAsync<TooManyRequestsException>(() =>
            Handler(ctx, victim, settings, audit).Handle(Cmd("k1", "shared"), default));
    }
}
