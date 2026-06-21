using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Vendor-neutral AI provider adapter — INACTIVE STUB. This is where a real model (e.g. an LLM) would be
/// called, with the vendor key read from <see cref="CoachAiSettings"/> on the SERVER only (never the client).
/// It is NOT wired: there is no vendor SDK/HTTP call here, so it ALWAYS returns a faulted task rather than
/// fabricate an analysis. The DI default stays <see cref="MockCoachAiProvider"/>; this is selected only when
/// <c>CoachAiSettings:Provider="vendor"</c>.
///
/// Honest degraded mode: a credit is reserved BEFORE <c>AnalyzeAsync</c> (see <c>AnalyzeHandCommandHandler</c>),
/// so a throw here triggers the handler's refund path — the user is never charged for an unavailable provider.
/// Wiring checklist: docs/commercial/ai-architecture.md.
/// </summary>
public sealed class VendorCoachAiProvider(CoachAiSettings settings) : ICoachAiProvider
{
    public string Id => "vendor-unconfigured";

    public Task<CoachAnalysisResult> AnalyzeAsync(CoachAnalysisInput input, CancellationToken ct = default)
    {
        // Faulted task (not a synchronous throw) so callers' await/try-catch and tests behave uniformly.
        if (!settings.HasApiKey)
        {
            return Task.FromException<CoachAnalysisResult>(new InvalidOperationException(
                "AI Coach vendor provider is selected but not configured: set CoachAiSettings:ApiKey " +
                "(server-side env, e.g. CoachAiSettings__ApiKey) — never on the client. " +
                "See docs/commercial/ai-architecture.md."));
        }

        // A key is present but no real adapter is wired — refuse to fabricate an analysis.
        return Task.FromException<CoachAnalysisResult>(new NotImplementedException(
            "AI Coach vendor adapter is a stub: wire the vendor SDK/HTTP call in VendorCoachAiProvider.AnalyzeAsync " +
            "before enabling CoachAiSettings:Provider=\"vendor\". Refusing to fabricate an analysis. " +
            "See docs/commercial/ai-architecture.md."));
    }
}
