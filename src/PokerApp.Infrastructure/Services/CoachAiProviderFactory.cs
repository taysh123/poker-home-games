using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Selects the AI Coach provider from <see cref="CoachAiSettings"/>. Extracted so the selection is unit-testable
/// directly (DI delegates to this) — inverting the branch breaks a test, not just production. Default =
/// <see cref="MockCoachAiProvider"/> (fail-closed). "anthropic" = <see cref="AnthropicCoachAiProvider"/> (real,
/// behind the server key); "vendor" = <see cref="VendorCoachAiProvider"/> (generic stub). The <paramref name="httpClient"/>
/// is only used by the Anthropic adapter; the <paramref name="grounding"/> provider anchors the mock + Anthropic
/// prompts to the app's calibrated data (the vendor stub never fabricates, so it takes none).
/// </summary>
public static class CoachAiProviderFactory
{
    public static ICoachAiProvider Create(CoachAiSettings settings, HttpClient httpClient, ICoachGroundingProvider grounding)
    {
        if (settings.UseAnthropic) return new AnthropicCoachAiProvider(settings, httpClient, grounding);
        if (settings.UseVendor) return new VendorCoachAiProvider(settings);
        return new MockCoachAiProvider(grounding);
    }
}
