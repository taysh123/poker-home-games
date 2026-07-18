using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// C3 server-side mock AI provider. Deterministic (no Random, no clock) educational coaching
/// that echoes the actual spot — hand, position, format, stack-depth — and reasons differently
/// for cash games vs tournaments (ICM / pay-jump / short-stack push-fold for MTT; chip-EV and
/// rake for cash). Adds a board-street-tagged point when a board is supplied, and scales
/// confidence from input completeness. Same input always produces identical output.
/// Never claims solver/GTO-optimal. Heuristic only; not real AI analysis.
/// </summary>
public sealed class MockCoachAiProvider(ICoachGroundingProvider grounding) : ICoachAiProvider
{
    public string Id => "mock-server";

    private const string Disclaimer =
        "Educational coaching feedback — not solver output and not guaranteed mathematically optimal.";

    public Task<CoachAnalysisResult> AnalyzeAsync(CoachAnalysisInput input, CancellationToken ct = default)
    {
        var isTournament = string.Equals(input.Format, "mtt", StringComparison.OrdinalIgnoreCase);
        var formatWord   = isTournament ? "tournament" : "cash game";
        var street       = ParseStreet(input.Board);
        var isShortStack = input.StackBb.HasValue && input.StackBb.Value <= 20;

        // ── Summary ───────────────────────────────────────────────────────────
        var spotDesc  = BuildSpotDescription(input);
        var stackDesc = input.StackBb.HasValue ? $" at {input.StackBb}bb" : "";
        var summary   = $"Reviewing {spotDesc}{stackDesc} in a {formatWord}.";

        // ── Mistakes ──────────────────────────────────────────────────────────
        var mistakes = new List<CoachPointDto>();

        if (isTournament)
        {
            if (isShortStack)
            {
                mistakes.Add(new CoachPointDto(
                    "Short-stack push/fold threshold",
                    $"With {input.StackBb}bb, commit to jam-or-fold decisions shaped by ICM pressure and " +
                    "pay-jump dynamics rather than standard NLHE ranges — a chip-EV call can be a " +
                    "tournament mistake when a pay jump is near.",
                    "preflop"));
            }
            else
            {
                mistakes.Add(new CoachPointDto(
                    "ICM pay-jump awareness",
                    "Protect your stack against ICM pay-jump risk. A chip-EV profitable call can be a " +
                    "tournament mistake if it threatens your survival near a pay jump.",
                    "preflop"));
            }
        }
        else
        {
            mistakes.Add(new CoachPointDto(
                "Stack-off frequency",
                "In a cash game, chip-EV is the only objective. Avoid marginal stack-off situations — " +
                "rake erodes thin calls, and committing your stack unnecessarily is very costly when " +
                "your equity is uncertain.",
                "preflop"));
        }

        if (street is not null)
        {
            mistakes.Add(new CoachPointDto(
                $"Bet sizing on the {street}",
                $"Calibrate your {street} sizing to your range and the board texture. " +
                "Over-betting polarizes your range and makes you easy to counter; " +
                "under-betting on the same texture leaves value behind.",
                street));
        }

        // ── Good Decisions ────────────────────────────────────────────────────
        var goodDecisions = new List<CoachPointDto>();

        if (isTournament)
        {
            goodDecisions.Add(new CoachPointDto(
                "Stack preservation mindset",
                "Protecting chips relative to ICM value is the right tournament instinct — " +
                "folding a marginally +EV spot is often correct when short-stack pay-jump " +
                "pressure makes stack preservation more important than raw chip gain.",
                "preflop"));
        }
        else
        {
            goodDecisions.Add(new CoachPointDto(
                "Position discipline",
                "Leveraging position in a cash game maximizes chip-EV. Positional advantage " +
                "compounds across many hands and is one of the highest-value levers available.",
                "preflop"));
        }

        if (street is not null)
        {
            goodDecisions.Add(new CoachPointDto(
                $"Continuing range on the {street}",
                $"Having a balanced {street} continuation range — some bluffs alongside your " +
                "value hands — makes you harder to exploit as your opponent faces a mixed " +
                "equity distribution.",
                street));
        }

        // ── Alternative Lines ─────────────────────────────────────────────────
        var alternativeLines = new List<AlternativeLineDto>();

        if (isTournament)
        {
            alternativeLines.Add(new AlternativeLineDto(
                "Tighter pre-flop range given ICM",
                "Consider folding marginal hands pre-flop when stack depth and pay-jump proximity " +
                "make the risk/reward less favorable than raw chip-EV suggests. Tournament survival " +
                "often outweighs a small pre-flop edge."));
        }
        else
        {
            alternativeLines.Add(new AlternativeLineDto(
                "Smaller c-bet on dry boards",
                "A smaller, more frequent bet on dry textures keeps your range well-protected " +
                "and targets rake-sensitive opponents who tend to over-fold to small bets."));
        }

        // ── Tips ──────────────────────────────────────────────────────────────
        var tips = new List<string>();

        if (isTournament)
        {
            tips.Add("Have a street-by-street plan before each action — in a tournament, " +
                     "stack depth and ICM shift which lines remain viable.");
            tips.Add("Review spots near pay jumps separately; ICM pressure meaningfully " +
                     "changes the math compared to chip-EV alone.");
        }
        else
        {
            tips.Add("Track your results by position across sessions — positional leaks " +
                     "are often the most recoverable chip-EV improvements.");
            tips.Add("Account for rake when evaluating marginal calling spots: thin calls " +
                     "lose more than they appear once rake is factored in.");
        }

        // C4 — surface ONE grounded, caveated calibrated fact (verbatim) so the flags-off demo shows real data.
        var grounded = grounding.SelectAssertions(input);
        if (grounded.Count > 0) tips.Add(grounded[0]);

        // ── Confidence (field-count heuristic, fully deterministic) ───────────
        var confidence = ComputeConfidence(input);

        var result = new CoachAnalysisResult(
            Summary:          summary,
            Mistakes:         mistakes,
            GoodDecisions:    goodDecisions,
            AlternativeLines: alternativeLines,
            Tips:             tips,
            Confidence:       confidence,
            ProviderId:       Id,
            Disclaimer:       Disclaimer);

        return Task.FromResult(result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static string BuildSpotDescription(CoachAnalysisInput input)
    {
        if (input.HeroHand is not null)
        {
            var pos     = input.HeroPosition is not null ? $" from {input.HeroPosition}" : "";
            var villain = input.VillainPosition is not null ? $" vs {input.VillainPosition}" : "";
            return $"{input.HeroHand}{pos}{villain}";
        }
        return input.Kind;
    }

    /// <summary>Returns the street name for the number of board cards, or null if no board.</summary>
    private static string? ParseStreet(string? board)
    {
        if (board is null) return null;
        var count = board.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        return count switch
        {
            3 => "flop",
            4 => "turn",
            5 => "river",
            _ => null,
        };
    }

    /// <summary>
    /// Confidence scales with how much information was provided.
    /// High (≥5 fields): hand + position + villain + board + stack + action text.
    /// Medium (3–4 fields). Low (&lt;3 fields).
    /// </summary>
    private static string ComputeConfidence(CoachAnalysisInput input)
    {
        var score = 0;
        if (input.HeroHand is not null)                          score++;
        if (input.HeroPosition is not null)                      score++;
        if (input.VillainPosition is not null)                   score++;
        if (input.Board is not null)                             score++;
        if (input.StackBb.HasValue)                              score++;
        if (!string.IsNullOrWhiteSpace(input.Text))              score++;

        return score switch
        {
            >= 5 => "high",
            >= 3 => "medium",
            _    => "low",
        };
    }
}
