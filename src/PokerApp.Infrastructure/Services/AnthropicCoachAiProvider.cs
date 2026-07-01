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
public sealed class AnthropicCoachAiProvider(CoachAiSettings settings, HttpClient httpClient) : ICoachAiProvider
{
    public string Id => "anthropic";

    private const string AnthropicVersion = "2023-06-01";
    private const string DefaultModel = "claude-sonnet-4-6";
    private const string Disclaimer =
        "Educational coaching feedback — not solver output and not guaranteed mathematically optimal.";

    private const string SystemPrompt =
        "You are a poker coach giving EDUCATIONAL feedback on a hand or spot. Never claim solver/GTO-optimal or " +
        "guaranteed-correct lines; be instructive and humble. Respond with ONLY a single JSON object (no markdown, " +
        "no prose) with keys: summary (string), mistakes (array of {title, detail, street}), goodDecisions (array " +
        "of {title, detail, street}), alternativeLines (array of {line, rationale}), tips (array of strings), " +
        "confidence (\"low\" | \"medium\" | \"high\"). Use [] for empty arrays. Keep each field concise.";

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

        var requestBody = new AnthropicRequest(
            Model: string.IsNullOrWhiteSpace(settings.Model) ? DefaultModel : settings.Model!,
            MaxTokens: 1024,
            System: SystemPrompt,
            Messages: new[] { new AnthropicMessage("user", BuildUserContent(input)) });

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
