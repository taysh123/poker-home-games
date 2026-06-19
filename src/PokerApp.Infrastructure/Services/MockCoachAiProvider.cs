using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// B2 server-side mock AI provider. The vendor key lives only on the server (a real impl reads it
/// from config). Returns deterministic, structured, EDUCATIONAL coaching — never solver/optimal claims.
/// </summary>
public sealed class MockCoachAiProvider : ICoachAiProvider
{
    public string Id => "mock-server";

    private const string Disclaimer =
        "Educational coaching feedback — not solver output and not guaranteed mathematically optimal.";

    public Task<CoachAnalysisResult> AnalyzeAsync(CoachAnalysisInput input, CancellationToken ct = default)
    {
        var what = input.HeroHand is not null ? $"{input.HeroHand} from {input.HeroPosition ?? "?"}" : input.Kind;
        var result = new CoachAnalysisResult(
            Summary: $"Coaching read on {what}. The line is reasonable; a few adjustments would tighten it.",
            Mistakes: new[] { new CoachPointDto("Sizing consistency", "Match bet sizes to your range so you're harder to read.", "general") },
            GoodDecisions: new[] { new CoachPointDto("Position discipline", "Playing tighter out of position is the right instinct.", "preflop") },
            AlternativeLines: new[] { new AlternativeLineDto("Smaller c-bet on dry boards", "Bet more often for less; keeps your range protected.") },
            Tips: new[] { "Have a plan for each street before acting.", "Review your own spots — it builds the fastest." },
            Confidence: "medium",
            ProviderId: Id,
            Disclaimer: Disclaimer);
        return Task.FromResult(result);
    }
}
