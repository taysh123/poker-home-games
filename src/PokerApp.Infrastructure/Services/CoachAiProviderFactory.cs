using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Selects the AI Coach provider from <see cref="CoachAiSettings"/>. Extracted so the mock|vendor decision is
/// unit-testable directly (DI delegates to this) — inverting the branch breaks a test, not just production.
/// Default = <see cref="MockCoachAiProvider"/> (fail-closed, deterministic); "vendor" =
/// <see cref="VendorCoachAiProvider"/> (a stub that throws until a real adapter is wired).
/// </summary>
public static class CoachAiProviderFactory
{
    public static ICoachAiProvider Create(CoachAiSettings settings) =>
        settings.UseVendor ? new VendorCoachAiProvider(settings) : new MockCoachAiProvider();
}
