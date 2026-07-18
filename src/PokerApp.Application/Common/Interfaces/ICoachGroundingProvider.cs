namespace PokerApp.Application.Common.Interfaces;

/// <summary>
/// Anchors the AI Coach to the app's OWN calibrated numbers instead of letting the model invent
/// frequencies. Selects the <c>safe_to_assert</c> grounded claims relevant to a hand (positions /
/// format / street) and returns their verbatim, caveat-bearing <c>assertion_template</c> strings.
///
/// THE HONESTY GATE (mirrored from the client <c>features/coach/logic/grounding.ts</c>): a claim is only
/// ever surfaced when <c>safe_to_assert == true</c>, and only via its <c>assertion_template</c> — never the
/// raw <c>claim_text</c>. Returns an empty list when nothing is relevant (never throws).
/// </summary>
public interface ICoachGroundingProvider
{
    /// <summary>
    /// The caveat-bearing <c>assertion_template</c> strings (verbatim) relevant to the hand — ONLY for
    /// <c>safe_to_assert == true</c> claims — or an empty list when nothing scores. At most <paramref name="max"/>.
    /// </summary>
    IReadOnlyList<string> SelectAssertions(CoachAnalysisInput input, int max = 5);
}
