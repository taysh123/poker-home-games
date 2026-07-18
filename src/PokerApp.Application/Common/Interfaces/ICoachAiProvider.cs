namespace PokerApp.Application.Common.Interfaces;

public sealed record CoachAnalysisInput(
    string Kind,
    string? Text,
    string? HeroHand,
    string? HeroPosition,
    string? Question,
    string? Board = null,
    string? VillainPosition = null,
    int? StackBb = null,
    string? Format = null);
public sealed record CoachPointDto(string Title, string Detail, string? Street);
public sealed record AlternativeLineDto(string Line, string Rationale);

/// <summary>Structured, educational coaching output (mirrors the client shape). Never solver/optimal claims.</summary>
public sealed record CoachAnalysisResult(
    string Summary,
    IReadOnlyList<CoachPointDto> Mistakes,
    IReadOnlyList<CoachPointDto> GoodDecisions,
    IReadOnlyList<AlternativeLineDto> AlternativeLines,
    IReadOnlyList<string> Tips,
    string Confidence,
    string ProviderId,
    string Disclaimer);

/// <summary>
/// Server-side AI provider seam. The vendor key lives ONLY here (server) — never on the client.
/// Vendor-agnostic; swap implementations without touching callers.
/// </summary>
public interface ICoachAiProvider
{
    string Id { get; }
    Task<CoachAnalysisResult> AnalyzeAsync(CoachAnalysisInput input, CancellationToken ct = default);
}
