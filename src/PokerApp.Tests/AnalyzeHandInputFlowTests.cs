using System;
using System.Threading;
using System.Threading.Tasks;
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
/// C1 — proves the AnalyzeHandCommandHandler carries board / villain position / stack / format
/// all the way through to the AI provider without silently dropping them.
/// Uses a capturing fake so no real provider or network is involved.
/// </summary>
public class AnalyzeHandInputFlowTests
{
    /// <summary>Records the CoachAnalysisInput the handler forwarded to the provider.</summary>
    private sealed class CapturingCoachProvider : ICoachAiProvider
    {
        public string Id => "capturing";
        public CoachAnalysisInput? LastInput { get; private set; }

        public Task<CoachAnalysisResult> AnalyzeAsync(CoachAnalysisInput input, CancellationToken ct = default)
        {
            LastInput = input;
            return Task.FromResult(new CoachAnalysisResult(
                Summary: "ok",
                Mistakes: Array.Empty<CoachPointDto>(),
                GoodDecisions: Array.Empty<CoachPointDto>(),
                AlternativeLines: Array.Empty<AlternativeLineDto>(),
                Tips: Array.Empty<string>(),
                Confidence: "medium",
                ProviderId: Id,
                Disclaimer: "test"));
        }
    }

    private static AnalyzeHandCommandHandler BuildHandler(AppDbContext ctx, Guid uid, CapturingCoachProvider provider)
    {
        var settings = new AiCreditSettings
        {
            Free    = new AiCreditPolicySettings { Kind = "lifetime", Credits = 10,  MinIntervalSeconds = 0 },
            Premium = new AiCreditPolicySettings { Kind = "monthly",  Credits = 100, MinIntervalSeconds = 0 },
        };
        var audit = new CapturingAuditLog();
        var fraud = new FraudEvaluator(ctx, new FraudSettings(), audit);
        return new AnalyzeHandCommandHandler(
            new EntitlementService(ctx),
            new AiCreditPolicyProvider(settings),
            new CreditLedger(ctx),
            provider,
            fraud,
            audit,
            new FakeCurrentUser(uid));
    }

    [Fact]
    public async Task Handler_passes_board_villainPosition_stackBb_format_to_provider()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();

        // Seed an active premium subscription so the handler has a credit to consume.
        ctx.Subscriptions.Add(Subscription.Create(
            uid, SubscriptionStore.Apple, "tpoker.premium.monthly", "txn-c1",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(20),
            true, false, DateTime.UtcNow));
        await ctx.SaveChangesAsync();

        var provider = new CapturingCoachProvider();
        var cmd = new AnalyzeHandCommand(
            Kind:            "manual",
            Text:            "raised BTN, BB called, cbet flop",
            HeroHand:        "AKs",
            HeroPosition:    "BTN",
            Question:        "Is this a shove?",
            IdempotencyKey:  "c1-flow-1",
            DeviceId:        null,
            Board:           "Ah 7d 2c",
            VillainPosition: "BB",
            StackBb:         25,
            Format:          "mtt");

        await BuildHandler(ctx, uid, provider).Handle(cmd, CancellationToken.None);

        Assert.NotNull(provider.LastInput);
        Assert.Equal("Ah 7d 2c", provider.LastInput!.Board);
        Assert.Equal("BB",        provider.LastInput.VillainPosition);
        Assert.Equal(25,          provider.LastInput.StackBb);
        Assert.Equal("mtt",       provider.LastInput.Format);
        // Existing fields must still be forwarded correctly.
        Assert.Equal("AKs",       provider.LastInput.HeroHand);
        Assert.Equal("BTN",       provider.LastInput.HeroPosition);
        Assert.Equal("raised BTN, BB called, cbet flop", provider.LastInput.Text);
        Assert.Equal("Is this a shove?", provider.LastInput.Question);
    }
}
