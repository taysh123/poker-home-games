using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Anthropic-backed AI Coach provider (real, behind the SERVER key). Calls the Anthropic Messages API over HTTP
/// (no SDK) and maps the response to <see cref="CoachAnalysisResult"/>. The key lives only on the server
/// (<see cref="CoachAiSettings.ApiKey"/>). Fail-closed: a missing key, non-2xx, network error, or malformed
/// response THROWS — never fabricates — and <c>AnalyzeHandCommand</c> refunds the reserved credit. Output is
/// strictly EDUCATIONAL (the system prompt forbids solver/optimal claims; the disclaimer is always attached).
/// </summary>
public sealed class AnthropicCoachAiProvider(CoachAiSettings settings, HttpClient httpClient, ICoachGroundingProvider grounding) : ICoachAiProvider
{
    public string Id => "anthropic";

    private const string AnthropicVersion = "2023-06-01";
    private const string DefaultModel = "claude-sonnet-4-6";
    private const string Disclaimer =
        "Educational coaching feedback — not solver output and not guaranteed mathematically optimal.";

    private const string SystemPrompt =
        "You are reviewing a hand the player ALREADY played, to help them study and improve. " +
        "This is after-the-fact educational analysis for learning — NOT live in-game advice and never " +
        "a real-time decision for a hand in progress.\n\n" +
        "Coaching process — work through the hand in sequence:\n" +
        "1. Street-by-street analysis: address preflop, then flop, then turn, then river, using the " +
        "actual board, action line, positions, and stack depth provided. Reference concrete details " +
        "from the input; avoid generic platitudes that could apply to any hand.\n\n" +
        "2. Format-aware reasoning — the same hand plays differently by format and stack depth:\n" +
        "   - Tournament (MTT): weigh ICM pressure, pay-jump survival, and big-blind antes. At short " +
        "stacks (~15bb) push/fold thresholds dominate; deep play prioritises accumulation vs survival. " +
        "ICM can make chip-EV shoves –EV when a pay jump is near.\n" +
        "   - Cash game: assume 100bb+ chip-EV play. No ICM. Apply stack-off math and rake awareness.\n\n" +
        "3. Missing information: if the board, positions, stack depth, or action are absent or " +
        "incomplete, state the assumptions you are making and lower the confidence field accordingly. " +
        "Full information may warrant 'high'; sparse information should be 'low' or 'medium'.\n\n" +
        "4. Principles over false precision: prefer strategic principles and ranges. Only assert a " +
        "specific numeric frequency or percentage when it is explicitly provided in the input as a " +
        "grounded fact. Never invent exact solver or GTO numbers. Never claim GTO-optimal, " +
        "solver-optimal, or guaranteed-correct lines.\n\n" +
        "5. Tone: instructive and humble. This is expert-calibrated educational feedback, not verified " +
        "optimal play.\n\n" +
        "Respond with ONLY a single raw JSON object (no markdown, no code fences, no prose outside the " +
        "JSON) with EXACTLY these keys: summary (string, 2-4 sentence overview), mistakes (array of " +
        "{title, detail, street}), goodDecisions (array of {title, detail, street}), alternativeLines " +
        "(array of {line, rationale}), tips (array of strings, 1-3 study takeaways), confidence " +
        "(\"low\"|\"medium\"|\"high\"). Use [] for empty arrays. " +
        "street must be one of: preflop, flop, turn, river, general. Keep each field concise.";

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public async Task<CoachAnalysisResult> AnalyzeAsync(CoachAnalysisInput input, CancellationToken ct = default)
    {
        if (!settings.HasApiKey)
            throw new InvalidOperationException(
                "AI Coach (Anthropic) is selected but not configured: set CoachAiSettings:ApiKey (server-side " +
                "env CoachAiSettings__ApiKey) — never on the client. See docs/commercial/ai-architecture.md.");

        var userContent = BuildUserContent(input);

        // C4 — anchor the model to OUR calibrated numbers: append the relevant safe_to_assert assertion_templates
        // (verbatim, caveats intact) so it cites our facts instead of inventing frequencies. C2 owns the system
        // prompt and the JSON contract — this only augments the user content.
        var groundedFacts = grounding.SelectAssertions(input);
        if (groundedFacts.Count > 0)
        {
            userContent = userContent
                + "\n\nGrounded reference facts (calibrated, not solver-exact — you MAY cite these verbatim; "
                + "do NOT invent other exact numbers):\n"
                + string.Join("\n", groundedFacts.Select(f => "- " + f));
        }

        var requestBody = new AnthropicRequest(
            Model: string.IsNullOrWhiteSpace(settings.Model) ? DefaultModel : settings.Model!,
            MaxTokens: 1536, // raised from 1024 — street-by-street analysis needs more room (no cost while mock-only)
            System: SystemPrompt,
            Messages: new[] { new AnthropicMessage("user", userContent) });

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{settings.ApiBase.TrimEnd('/')}/v1/messages")
        {
            Content = JsonContent.Create(requestBody, options: Json),
        };
        request.Headers.Add("x-api-key", settings.ApiKey!);
        request.Headers.Add("anthropic-version", AnthropicVersion);

        using var response = await httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Anthropic API returned {(int)response.StatusCode}: {await SafeReadAsync(response, ct)}");

        AnthropicResponse? parsed;
        try { parsed = await response.Content.ReadFromJsonAsync<AnthropicResponse>(Json, ct); }
        catch (JsonException ex) { throw new InvalidOperationException("Anthropic returned an unparseable response body.", ex); }

        var text = parsed?.Content?.FirstOrDefault(b => b.Type == "text")?.Text;
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("Anthropic API returned no text content.");

        return Map(ParseCoaching(text));
    }

    private static string BuildUserContent(CoachAnalysisInput input)
    {
        var parts = new List<string> { $"Kind: {input.Kind}" };
        if (!string.IsNullOrWhiteSpace(input.Format))
        {
            var fmtLabel = input.Format.Equals("mtt",  StringComparison.OrdinalIgnoreCase) ? "Tournament"
                         : input.Format.Equals("cash", StringComparison.OrdinalIgnoreCase) ? "Cash"
                         : input.Format;
            parts.Add($"Format: {fmtLabel}");
        }
        if (!string.IsNullOrWhiteSpace(input.HeroHand))      parts.Add($"Hero hand: {input.HeroHand}");
        if (!string.IsNullOrWhiteSpace(input.HeroPosition))   parts.Add($"Hero position: {input.HeroPosition}");
        if (!string.IsNullOrWhiteSpace(input.VillainPosition)) parts.Add($"Villain position: {input.VillainPosition}");
        if (input.StackBb.HasValue)                            parts.Add($"Effective stack: {input.StackBb}bb");
        if (!string.IsNullOrWhiteSpace(input.Board))           parts.Add($"Board: {input.Board}");
        if (!string.IsNullOrWhiteSpace(input.Text))            parts.Add($"Details: {input.Text}");
        if (!string.IsNullOrWhiteSpace(input.Question))        parts.Add($"Question: {input.Question}");
        return string.Join("\n", parts);
    }

    private CoachAnalysisResult Map(CoachingJson c) => new(
        Summary: c.Summary ?? string.Empty,
        Mistakes: (c.Mistakes ?? new()).Select(m => new CoachPointDto(m.Title ?? string.Empty, m.Detail ?? string.Empty, m.Street)).ToList(),
        GoodDecisions: (c.GoodDecisions ?? new()).Select(m => new CoachPointDto(m.Title ?? string.Empty, m.Detail ?? string.Empty, m.Street)).ToList(),
        AlternativeLines: (c.AlternativeLines ?? new()).Select(a => new AlternativeLineDto(a.Line ?? string.Empty, a.Rationale ?? string.Empty)).ToList(),
        Tips: c.Tips ?? new(),
        Confidence: string.IsNullOrWhiteSpace(c.Confidence) ? "medium" : c.Confidence!,
        ProviderId: Id,
        Disclaimer: Disclaimer);

    private static CoachingJson ParseCoaching(string text)
    {
        try
        {
            return JsonSerializer.Deserialize<CoachingJson>(ExtractJson(text), Json)
                   ?? throw new InvalidOperationException("Anthropic response coaching JSON was empty.");
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException("Anthropic response was not valid coaching JSON.", ex);
        }
    }

    // The model is told to return raw JSON, but strip ```/```json fences defensively if present.
    private static string ExtractJson(string text)
    {
        var t = text.Trim();
        if (!t.StartsWith("```")) return t;
        var firstNewline = t.IndexOf('\n');
        if (firstNewline >= 0) t = t[(firstNewline + 1)..];
        if (t.EndsWith("```")) t = t[..^3];
        return t.Trim();
    }

    private static async Task<string> SafeReadAsync(HttpResponseMessage r, CancellationToken ct)
    {
        try { return await r.Content.ReadAsStringAsync(ct); } catch { return string.Empty; }
    }

    private sealed record AnthropicRequest(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("max_tokens")] int MaxTokens,
        [property: JsonPropertyName("system")] string System,
        [property: JsonPropertyName("messages")] IReadOnlyList<AnthropicMessage> Messages);

    private sealed record AnthropicMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private sealed record AnthropicResponse(
        [property: JsonPropertyName("content")] List<AnthropicContentBlock>? Content);

    private sealed record AnthropicContentBlock(
        [property: JsonPropertyName("type")] string? Type,
        [property: JsonPropertyName("text")] string? Text);

    private sealed record CoachingJson(
        string? Summary, List<CoachingPoint>? Mistakes, List<CoachingPoint>? GoodDecisions,
        List<CoachingAlt>? AlternativeLines, List<string>? Tips, string? Confidence);

    private sealed record CoachingPoint(string? Title, string? Detail, string? Street);
    private sealed record CoachingAlt(string? Line, string? Rationale);
}
