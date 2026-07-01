using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Server-side grounding provider backed by the embedded <c>coach_grounding</c> dataset (a verbatim copy of the
/// workbook-0.8.1 client artifact). Reads + parses the JSON ONCE on construction and caches the assertable claims.
///
/// THE HONESTY GATE is mirrored from the client (<c>features/coach/logic/grounding.ts</c>): only
/// <c>safe_to_assert == true</c> claims with a non-empty <c>assertion_template</c> are kept, and only the verbatim
/// <c>assertion_template</c> is ever surfaced — NEVER the raw <c>claim_text</c>. A missing/blank/malformed resource
/// degrades to an empty set (never throws).
/// </summary>
public sealed class CoachGroundingProvider : ICoachGroundingProvider
{
    private readonly IReadOnlyList<GroundedClaim> _claims;

    /// <summary>DI path — reads the embedded dataset once and caches the gated claims.</summary>
    public CoachGroundingProvider() => _claims = LoadEmbedded();

    /// <summary>
    /// Explicit-dataset path (tests / alternate datasets). Applies the same honesty gate as the embedded path.
    /// </summary>
    public CoachGroundingProvider(string groundingJson) => _claims = ParseAssertable(groundingJson);

    public IReadOnlyList<string> SelectAssertions(CoachAnalysisInput input, int max = 5)
    {
        if (max <= 0 || _claims.Count == 0) return System.Array.Empty<string>();

        var heroPos    = RecognizePosition(input.HeroPosition);
        var villainPos = RecognizePosition(input.VillainPosition);
        var isMtt      = string.Equals(input.Format, "mtt",  StringComparison.OrdinalIgnoreCase);
        var isCash     = string.Equals(input.Format, "cash", StringComparison.OrdinalIgnoreCase);
        var hasStreet  = HasStreet(input.Board);

        // Score every assertable claim by keyword overlap; keep only those that score; rank by score
        // (ties broken by original order — OrderByDescending is a stable sort; the explicit index makes it obvious).
        var ranked = _claims
            .Select((claim, index) => (claim, index, score: Score(claim.ClaimText, heroPos, villainPos, isMtt, isCash, hasStreet)))
            .Where(x => x.score > 0)
            .OrderByDescending(x => x.score)
            .ThenBy(x => x.index);

        // Return DISTINCT assertion_templates (the dataset carries exact-duplicate claim texts across concept ids,
        // so we hand the model N distinct grounded facts, not the same sentence repeated), capped at `max`.
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<string>(max);
        foreach (var x in ranked)
        {
            if (seen.Add(x.claim.AssertionTemplate)) result.Add(x.claim.AssertionTemplate);
            if (result.Count == max) break;
        }
        return result;
    }

    // ── Relevance heuristic (deterministic, testable) ──────────────────────────

    private static readonly string[] Positions        = { "UTG", "HJ", "CO", "BTN", "SB", "BB" };
    private static readonly string[] MttKeywords       = { "icm", "nash", "push", "fold", "jam" };
    private static readonly string[] DeepStackKeywords = { "rfi", "3-bet", "c-bet" };
    private static readonly string[] StreetKeywords    = { "c-bet", "barrel", "flop", "turn", "river" };

    private static int Score(string text, string? heroPos, string? villainPos, bool isMtt, bool isCash, bool hasStreet)
    {
        var score = 0;

        if (heroPos    is not null && ContainsToken(text, heroPos))    score += 2;
        if (villainPos is not null && ContainsToken(text, villainPos)) score += 1;

        if (isMtt)
        {
            if (ContainsAny(text, MttKeywords)) score += 2;
        }
        else if (isCash)
        {
            // Deep-stack cash scenarios: RFI / 3-bet / c-bet at 100bb. (An absent format gets NO boost, so a
            // truly signal-less query — unrecognised position, no format, no board — returns nothing.)
            if (Contains(text, "100bb") && ContainsAny(text, DeepStackKeywords)) score += 1;
        }

        if (hasStreet && ContainsAny(text, StreetKeywords)) score += 1;

        return score;
    }

    /// <summary>The recognised position token (UTG/HJ/CO/BTN/SB/BB) named by the input, or null if unrecognised.</summary>
    private static string? RecognizePosition(string? pos)
    {
        if (string.IsNullOrWhiteSpace(pos)) return null;
        foreach (var p in Positions)
            if (ContainsToken(pos, p)) return p;
        return null;
    }

    /// <summary>Street from the board: 3 cards ⇒ flop, 4 ⇒ turn, 5 ⇒ river (else no street).</summary>
    private static bool HasStreet(string? board)
    {
        if (string.IsNullOrWhiteSpace(board)) return false;
        var count = board.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        return count is 3 or 4 or 5;
    }

    private static bool Contains(string text, string sub) => text.Contains(sub, StringComparison.OrdinalIgnoreCase);

    private static bool ContainsAny(string text, string[] subs)
    {
        foreach (var s in subs)
            if (Contains(text, s)) return true;
        return false;
    }

    // Word-boundary match so a hero of "CO" doesn't hit "combos" and "BB" doesn't hit "100bb".
    private static bool ContainsToken(string text, string token)
        => Regex.IsMatch(text, $@"\b{Regex.Escape(token)}\b", RegexOptions.IgnoreCase);

    // ── Loading + honesty gate ─────────────────────────────────────────────────

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static IReadOnlyList<GroundedClaim> LoadEmbedded()
    {
        try
        {
            var asm = typeof(CoachGroundingProvider).Assembly;
            var name = System.Array.Find(
                asm.GetManifestResourceNames(),
                n => n.EndsWith("coach_grounding.json", StringComparison.OrdinalIgnoreCase));
            if (name is null) return System.Array.Empty<GroundedClaim>();

            using var stream = asm.GetManifestResourceStream(name);
            if (stream is null) return System.Array.Empty<GroundedClaim>();

            using var reader = new StreamReader(stream, Encoding.UTF8);
            return ParseAssertable(reader.ReadToEnd());
        }
        catch
        {
            // Tolerate a missing/blank/unreadable resource — degrade to an empty set, never throw.
            return System.Array.Empty<GroundedClaim>();
        }
    }

    private static IReadOnlyList<GroundedClaim> ParseAssertable(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return System.Array.Empty<GroundedClaim>();

        GroundingDatasetDto? dataset;
        try { dataset = JsonSerializer.Deserialize<GroundingDatasetDto>(json, JsonOpts); }
        catch (JsonException) { return System.Array.Empty<GroundedClaim>(); }

        var rows = dataset?.Claims;
        if (rows is null) return System.Array.Empty<GroundedClaim>();

        var kept = new List<GroundedClaim>(rows.Count);
        foreach (var r in rows)
        {
            // The gate: only safe_to_assert claims with a non-empty template ever survive, and we keep the
            // claim_text (for relevance scoring) alongside the template (the only string ever surfaced).
            if (r is null) continue;
            if (!r.SafeToAssert) continue;
            if (string.IsNullOrWhiteSpace(r.AssertionTemplate)) continue;
            if (string.IsNullOrWhiteSpace(r.ClaimText)) continue;
            kept.Add(new GroundedClaim(r.ClaimText!, r.AssertionTemplate!));
        }
        return kept;
    }

    /// <summary>An assertable claim: its text (for scoring) and the verbatim template (the only string surfaced).</summary>
    private sealed record GroundedClaim(string ClaimText, string AssertionTemplate);

    private sealed record GroundingDatasetDto(
        [property: JsonPropertyName("claims")] List<GroundingClaimDto>? Claims);

    private sealed record GroundingClaimDto(
        [property: JsonPropertyName("claim_text")] string? ClaimText,
        [property: JsonPropertyName("assertion_template")] string? AssertionTemplate,
        [property: JsonPropertyName("safe_to_assert")] bool SafeToAssert);
}
