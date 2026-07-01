using System;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Phase 2 — Anthropic AI adapter. Proves it is honest + fail-closed: throws without a key, parses a real
/// Anthropic envelope into an EDUCATIONAL result, and throws (→ credit refund) on non-2xx / malformed bodies.
/// Uses a fake HttpMessageHandler — no network, no SDK, no extra test dependency.
/// </summary>
public class AnthropicCoachAiProviderTests
{
    private static CoachAnalysisInput Input() => new("hand", "AKs button 3-bet pot", "AKs", "BTN", null);

    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            LastRequest = request;
            return Task.FromResult(new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
        }
    }

    // Wrap inner coaching JSON as an Anthropic Messages response: content[0].text is the JSON-as-a-string.
    private static string AnthropicEnvelope(string innerJson)
    {
        var textField = JsonSerializer.Serialize(innerJson); // correctly quoted + escaped
        return $"{{ \"content\": [ {{ \"type\": \"text\", \"text\": {textField} }} ] }}";
    }

    private static string ValidInner() => JsonSerializer.Serialize(new
    {
        summary = "Solid open.",
        mistakes = new[] { new { title = "Sizing", detail = "Bigger 3bet OOP.", street = "preflop" } },
        goodDecisions = Array.Empty<object>(),
        alternativeLines = new[] { new { line = "Flat", rationale = "Keeps range wide." } },
        tips = new[] { "Have a plan." },
        confidence = "high",
    });

    private static AnthropicCoachAiProvider Provider(HttpStatusCode status, string body, string? apiKey = "test-key")
        => new(new CoachAiSettings { Provider = "anthropic", ApiKey = apiKey }, new HttpClient(new StubHandler(status, body)));

    [Fact]
    public async Task Throws_when_no_api_key()
    {
        var p = new AnthropicCoachAiProvider(
            new CoachAiSettings { Provider = "anthropic" }, // no ApiKey
            new HttpClient(new StubHandler(HttpStatusCode.OK, AnthropicEnvelope(ValidInner()))));
        await Assert.ThrowsAsync<InvalidOperationException>(() => p.AnalyzeAsync(Input()));
    }

    [Fact]
    public async Task Parses_a_valid_response_into_an_educational_result()
    {
        var handler = new StubHandler(HttpStatusCode.OK, AnthropicEnvelope(ValidInner()));
        var p = new AnthropicCoachAiProvider(new CoachAiSettings { Provider = "anthropic", ApiKey = "test-key" }, new HttpClient(handler));

        var result = await p.AnalyzeAsync(Input());

        Assert.Equal("anthropic", result.ProviderId);
        Assert.Equal("Solid open.", result.Summary);
        Assert.Single(result.Mistakes);
        Assert.Equal("Sizing", result.Mistakes[0].Title);
        Assert.Single(result.AlternativeLines);
        Assert.Equal("high", result.Confidence);
        Assert.Contains("Educational", result.Disclaimer, StringComparison.OrdinalIgnoreCase);
        // The request carried the server key + version header and hit /v1/messages.
        Assert.True(handler.LastRequest!.Headers.Contains("x-api-key"));
        Assert.EndsWith("/v1/messages", handler.LastRequest!.RequestUri!.AbsoluteUri);
    }

    [Fact]
    public async Task Throws_on_non_2xx()
    {
        var p = Provider(HttpStatusCode.InternalServerError, "boom");
        await Assert.ThrowsAsync<InvalidOperationException>(() => p.AnalyzeAsync(Input()));
    }

    [Fact]
    public async Task Throws_on_malformed_body()
    {
        var p = Provider(HttpStatusCode.OK, "{ not json");
        await Assert.ThrowsAsync<InvalidOperationException>(() => p.AnalyzeAsync(Input()));
    }

    /// <summary>
    /// C1 — proves BuildUserContent renders board / villain position / effective stack / format
    /// label into the outbound Anthropic request body. Uses FakeHttpMessageHandler (captures body
    /// at send time) — no real network call.
    /// </summary>
    [Fact]
    public async Task BuildUserContent_renders_board_villain_stack_format_in_prompt()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, AnthropicEnvelope(ValidInner()));
        var p = new AnthropicCoachAiProvider(
            new CoachAiSettings { Provider = "anthropic", ApiKey = "test-key" },
            new HttpClient(handler));

        var input = new CoachAnalysisInput(
            Kind:            "manual",
            Text:            "raised BTN, BB 3-bet, I called",
            HeroHand:        "AKs",
            HeroPosition:    "BTN",
            Question:        "Is this a shove?",
            Board:           "Ah 7d 2c",
            VillainPosition: "BB",
            StackBb:         25,
            Format:          "mtt");

        await p.AnalyzeAsync(input);

        var body = handler.LastRequestBody!;
        Assert.False(string.IsNullOrEmpty(body));
        // "mtt" must be mapped to the human-readable label "Tournament".
        Assert.Contains("Tournament", body);
        // Villain position line must appear verbatim in the JSON-serialised content.
        Assert.Contains("Villain position: BB", body);
        // Effective stack label + depth must appear.
        Assert.Contains("25bb", body);
        // Board must appear with its label.
        Assert.Contains("Board: Ah 7d 2c", body);
    }
}
