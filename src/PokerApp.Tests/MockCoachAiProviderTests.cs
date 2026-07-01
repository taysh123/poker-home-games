using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// C3 — proves the mock AI provider is hand-aware and format-aware:
/// echoes real spot details, differs for cash vs tournament, tags streets, is deterministic,
/// scales confidence from input completeness, and never claims solver/GTO.
/// </summary>
public class MockCoachAiProviderTests
{
    private static MockCoachAiProvider Provider() => new(StubCoachGroundingProvider.Empty);

    [Fact]
    public async Task Echoes_the_hand_and_position_in_the_summary()
    {
        var input = new CoachAnalysisInput(
            Kind: "hand",
            Text: "raised BTN, BB called",
            HeroHand: "AKs",
            HeroPosition: "BTN",
            Question: null,
            Format: "cash");

        var result = await Provider().AnalyzeAsync(input);

        Assert.Contains("AKs", result.Summary, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("BTN", result.Summary, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Cash_and_tournament_analysis_differ()
    {
        var cashInput = new CoachAnalysisInput(
            Kind: "hand",
            Text: "3-bet pot, cbet flop",
            HeroHand: "QQ",
            HeroPosition: "BTN",
            Question: null,
            Board: "Ah 7d 2c",
            VillainPosition: "BB",
            StackBb: 100,
            Format: "cash");

        var mttInput = cashInput with { StackBb = 15, Format = "mtt" };

        var cashResult = await Provider().AnalyzeAsync(cashInput);
        var mttResult  = await Provider().AnalyzeAsync(mttInput);

        // Summaries must differ
        Assert.NotEqual(cashResult.Summary, mttResult.Summary);

        // Collect all analysis text for each result (not the disclaimer)
        static string CombineText(CoachAnalysisResult r) => string.Join(" ",
            new[] { r.Summary }
            .Concat(r.Mistakes.Select(m => m.Title + " " + m.Detail))
            .Concat(r.GoodDecisions.Select(g => g.Title + " " + g.Detail))
            .Concat(r.AlternativeLines.Select(a => a.Line + " " + a.Rationale))
            .Concat(r.Tips));

        var cashText = CombineText(cashResult);
        var mttText  = CombineText(mttResult);

        // Tournament must mention ICM / pay-jump / short-stack concepts
        var mttKeywords = new[] { "icm", "pay jump", "pay-jump", "short-stack", "push/fold", "push fold" };
        Assert.True(
            mttKeywords.Any(kw => mttText.Contains(kw, StringComparison.OrdinalIgnoreCase)),
            $"Tournament output should mention ICM/pay-jump/short-stack, got: {mttText}");

        // Cash must NOT mention ICM / pay-jump concepts
        Assert.False(
            mttKeywords.Any(kw => cashText.Contains(kw, StringComparison.OrdinalIgnoreCase)),
            $"Cash output should not mention ICM/pay-jump/short-stack, got: {cashText}");

        // Cash must mention chip-EV / rake / deep / stack-off concepts
        var cashKeywords = new[] { "chip-ev", "chip ev", "rake", "deep", "stack-off", "stack off" };
        Assert.True(
            cashKeywords.Any(kw => cashText.Contains(kw, StringComparison.OrdinalIgnoreCase)),
            $"Cash output should mention chip-EV/rake/deep, got: {cashText}");
    }

    [Fact]
    public async Task Board_adds_a_street_tagged_point()
    {
        // Flop board — 3 cards
        var flopInput = new CoachAnalysisInput(
            Kind: "hand",
            Text: null,
            HeroHand: "KQs",
            HeroPosition: "CO",
            Question: null,
            Board: "Ah 7d 2c");

        var flopResult = await Provider().AnalyzeAsync(flopInput);
        var flopPoints = flopResult.Mistakes.Concat(flopResult.GoodDecisions).ToList();
        Assert.True(
            flopPoints.Any(p => string.Equals(p.Street, "flop", StringComparison.OrdinalIgnoreCase)),
            "Expected a point with Street='flop' for a 3-card board");

        // River board — 5 cards
        var riverInput = flopInput with { Board = "Ah 7d 2c Ks Qh" };
        var riverResult = await Provider().AnalyzeAsync(riverInput);
        var riverPoints = riverResult.Mistakes.Concat(riverResult.GoodDecisions).ToList();
        Assert.True(
            riverPoints.Any(p => string.Equals(p.Street, "river", StringComparison.OrdinalIgnoreCase)),
            "Expected a point with Street='river' for a 5-card board");
    }

    [Fact]
    public async Task Deterministic_same_input_same_output()
    {
        var input = new CoachAnalysisInput(
            Kind: "hand",
            Text: "open BTN, BB calls, cbet flop",
            HeroHand: "AJs",
            HeroPosition: "BTN",
            Question: "Should I barrel turn?",
            Board: "Kd 8h 3c",
            VillainPosition: "BB",
            StackBb: 100,
            Format: "cash");

        var r1 = await Provider().AnalyzeAsync(input);
        var r2 = await Provider().AnalyzeAsync(input);

        Assert.Equal(r1.Summary,    r2.Summary);
        Assert.Equal(r1.Confidence, r2.Confidence);
        Assert.Equal(r1.Mistakes.Count,        r2.Mistakes.Count);
        Assert.Equal(r1.GoodDecisions.Count,   r2.GoodDecisions.Count);
        Assert.Equal(r1.AlternativeLines.Count, r2.AlternativeLines.Count);
        Assert.Equal(r1.Tips.Count,            r2.Tips.Count);
        // Deep structural equality via serialization
        Assert.Equal(
            JsonSerializer.Serialize(r1),
            JsonSerializer.Serialize(r2));
    }

    [Fact]
    public async Task Sparse_input_lowers_confidence()
    {
        // Minimal: only Kind — everything else null/absent
        var sparse = new CoachAnalysisInput(Kind: "general", Text: null, HeroHand: null, HeroPosition: null, Question: null);
        var sparseResult = await Provider().AnalyzeAsync(sparse);
        Assert.Equal("low", sparseResult.Confidence);

        // Rich: hand + position + villain + board + stack + actions all present
        var rich = new CoachAnalysisInput(
            Kind: "hand",
            Text: "opened CO, BTN 3-bet, called, cbet flop, barrel turn",
            HeroHand: "TT",
            HeroPosition: "CO",
            Question: "Call or fold to 3-bet?",
            Board: "9s 5h 2c",
            VillainPosition: "BTN",
            StackBb: 100,
            Format: "cash");
        var richResult = await Provider().AnalyzeAsync(rich);
        Assert.NotEqual("low", richResult.Confidence);
    }

    [Fact]
    public async Task Never_claims_solver_or_gto()
    {
        var inputs = new[]
        {
            new CoachAnalysisInput("hand", "spot", "AKs", "BTN", null, Format: "cash"),
            new CoachAnalysisInput("hand", "spot", "77",  "BB",  null, Board: "Ah 7d 2c", StackBb: 15, Format: "mtt"),
        };

        foreach (var input in inputs)
        {
            var r = await Provider().AnalyzeAsync(input);

            // Check analysis fields only — Disclaimer intentionally says "not solver output"
            var analysisTexts = new[] { r.Summary }
                .Concat(r.Mistakes.Select(m => m.Title + " " + m.Detail))
                .Concat(r.GoodDecisions.Select(g => g.Title + " " + g.Detail))
                .Concat(r.AlternativeLines.Select(a => a.Line + " " + a.Rationale))
                .Concat(r.Tips)
                .ToList();

            foreach (var text in analysisTexts)
            {
                Assert.DoesNotContain("GTO-optimal", text, StringComparison.OrdinalIgnoreCase);
                Assert.DoesNotContain("guaranteed",  text, StringComparison.OrdinalIgnoreCase);
                Assert.DoesNotContain("solver",      text, StringComparison.OrdinalIgnoreCase);
            }
        }
    }

    /// <summary>
    /// C4 — the mock surfaces the FIRST selected grounded assertion (verbatim, caveat intact) as an extra tip,
    /// so the flags-off demo shows a real, calibrated number. Uses a fixed stub grounding provider.
    /// </summary>
    [Fact]
    public async Task Injects_the_first_grounded_assertion_as_a_tip()
    {
        const string assertion =
            "UTG opens ~13.4% (RFI) at 100bb 6-max (Calibrated; source: Derived from calibrated ranges). Not solver-exact.";
        var provider = new MockCoachAiProvider(new StubCoachGroundingProvider(new[] { assertion }));
        var input = new CoachAnalysisInput("hand", null, "AKs", "UTG", null, Format: "cash");

        var result = await provider.AnalyzeAsync(input);

        Assert.Contains(assertion, result.Tips);
    }
}
