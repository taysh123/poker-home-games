using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Selects the AI Coach provider from <see cref="CoachAiSettings"/>. Extracted so the selection is unit-testable
/// directly (DI delegates to this) — inverting the branch breaks a test, not just production. Default =
/// <see cref="MockCoachAiProvider"/> (fail-closed). "anthropic" = <see cref="AnthropicCoachAiProvider"/> (real,
/// behind the server key); "vendor" = <see cref="VendorCoachAiProvider"/> (generic stub). The <paramref name="httpClient"/>
/// is only used by the Anthropic adapter.
/// </summary>
public static class CoachAiProviderFactory
{
    public static ICoachAiProvider Create(CoachAiSettings settings, HttpClient httpClient)
    {
        if (settings.UseAnthropic) return new AnthropicCoachAiProvider(settings, httpClient);
        if (settings.UseVendor) return new VendorCoachAiProvider(settings);
        return new MockCoachAiProvider();
    }
}
