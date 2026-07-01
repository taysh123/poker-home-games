using System;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// C4 — the server-side grounding selector. Proves it anchors the coach to the app's OWN calibrated data:
/// selects claims by the hand's positions/format/street, enforces the safe_to_assert honesty gate, only ever
/// surfaces verbatim caveat-bearing assertion_templates (never raw claim_text), and caps the result.
/// </summary>
public class CoachGroundingTests
{
    // The real embedded workbook-0.8.1 dataset (95 claims, all safe_to_assert).
    private static readonly CoachGroundingProvider Provider = new();

    [Fact]
    public void Selects_UTG_RFI_claim_for_a_UTG_cash_hand()
    {
        var input = new CoachAnalysisInput("hand", null, "AKs", "UTG", null, Format: "cash");

        var facts = Provider.SelectAssertions(input);

        Assert.Contains(facts, f =>
            f.Contains("UTG opens ~13.4%", StringComparison.Ordinal) &&
            f.Contains("RFI", StringComparison.Ordinal));
    }

    [Fact]
    public void Selects_icm_and_pushfold_for_a_short_mtt_hand()
    {
        var input = new CoachAnalysisInput("hand", null, "AhKh", "BTN", null, StackBb: 10, Format: "mtt");

        var facts = Provider.SelectAssertions(input);

        Assert.Contains(facts, f =>
            f.Contains("ICM", StringComparison.Ordinal) ||
            f.Contains("Nash push/fold", StringComparison.Ordinal) ||
            f.Contains("jams", StringComparison.Ordinal));
    }

    [Fact]
    public void Returns_empty_when_nothing_relevant()
    {
        // Unrecognised position, no format, no board ⇒ nothing scores.
        var input = new CoachAnalysisInput("hand", null, "AKs", "ZZ", null);

        var facts = Provider.SelectAssertions(input);

        Assert.Empty(facts);
    }

    [Fact]
    public void Only_returns_safe_to_assert_and_verbatim_templates()
    {
        var input = new CoachAnalysisInput("hand", null, "AKs", "UTG", null, Format: "cash");

        var facts = Provider.SelectAssertions(input);

        Assert.NotEmpty(facts);
        // Every returned string is a verbatim assertion_template: it carries the "; source:" citation (present in
        // every template, in NO raw claim_text) and ends with its caveat sentence — proving raw claim_text never leaks.
        Assert.All(facts, f =>
        {
            Assert.Contains("; source:", f);
            Assert.True(
                f.EndsWith("Not solver-exact.", StringComparison.Ordinal) ||
                f.EndsWith("Model-dependent (ICM/payouts).", StringComparison.Ordinal),
                $"Returned string is not a caveat-bearing assertion_template: {f}");
        });

        // The gate: a synthetic UNSAFE claim (safe_to_assert=false) that would otherwise match is NEVER returned.
        const string json =
            "{ \"claims\": [" +
            "{ \"grounding_id\":\"S1\", \"claim_text\":\"UTG opens ~99.9% (RFI) at 100bb 6-max\", " +
            "\"assertion_template\":\"SAFE-UTG-TEMPLATE (Calibrated; source: test). Not solver-exact.\", \"safe_to_assert\": true }," +
            "{ \"grounding_id\":\"U1\", \"claim_text\":\"UTG opens ~99.9% (RFI) at 100bb 6-max\", " +
            "\"assertion_template\":\"UNSAFE-UTG-TEMPLATE (Calibrated; source: test). Not solver-exact.\", \"safe_to_assert\": false }" +
            "] }";
        var synthetic = new CoachGroundingProvider(json);

        var got = synthetic.SelectAssertions(input);

        Assert.Contains("SAFE-UTG-TEMPLATE (Calibrated; source: test). Not solver-exact.", got);
        Assert.DoesNotContain("UNSAFE-UTG-TEMPLATE (Calibrated; source: test). Not solver-exact.", got);
    }

    [Fact]
    public void Respects_the_max_cap()
    {
        var input = new CoachAnalysisInput("hand", null, "AKs", "UTG", null, Format: "cash");

        var facts = Provider.SelectAssertions(input, max: 2);

        Assert.True(facts.Count <= 2, $"Expected at most 2 assertions, got {facts.Count}");
    }
}
