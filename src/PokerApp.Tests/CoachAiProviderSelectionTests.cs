using System;
using System.Threading.Tasks;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Phase D — AI provider scaffold. Proves the config switch is honest: mock is the default, the vendor
/// adapter is selectable but throws (never fabricates), and the key is required server-side.
/// </summary>
public class CoachAiProviderSelectionTests
{
    private static CoachAnalysisInput SampleInput() => new("hand", "AKs on the button, 3-bet pot", "AKs", "BTN", null);

    [Fact]
    public void Default_settings_select_the_mock_provider()
    {
        var settings = new CoachAiSettings();
        Assert.Equal("mock", settings.Provider);
        Assert.False(settings.UseVendor);
        Assert.False(settings.HasApiKey);
    }

    [Theory]
    [InlineData("vendor", true)]
    [InlineData("VENDOR", true)]
    [InlineData("Vendor", true)]
    [InlineData("mock", false)]
    [InlineData("", false)]
    public void UseVendor_is_case_insensitive(string provider, bool expected)
    {
        Assert.Equal(expected, new CoachAiSettings { Provider = provider }.UseVendor);
    }

    [Fact]
    public async Task Mock_provider_returns_a_structured_educational_result()
    {
        var result = await new MockCoachAiProvider().AnalyzeAsync(SampleInput());
        Assert.NotNull(result);
        Assert.Equal("mock-server", result.ProviderId);
        Assert.False(string.IsNullOrWhiteSpace(result.Summary));
        Assert.Contains("Educational", result.Disclaimer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Vendor_stub_throws_not_configured_without_a_key()
    {
        var provider = new VendorCoachAiProvider(new CoachAiSettings { Provider = "vendor" });
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => provider.AnalyzeAsync(SampleInput()));
        Assert.Contains("not configured", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Vendor_stub_never_fabricates_even_with_a_key()
    {
        // A key is set but no real adapter is wired — it must STILL refuse to produce a (fake) analysis.
        var provider = new VendorCoachAiProvider(new CoachAiSettings { Provider = "vendor", ApiKey = "test-key" });
        await Assert.ThrowsAsync<NotImplementedException>(() => provider.AnalyzeAsync(SampleInput()));
    }

    // The factory is what DI delegates to (DependencyInjection.cs) — these guard the actual selection branch,
    // so inverting it breaks a test rather than silently shipping the wrong provider.
    [Fact]
    public void Factory_returns_mock_by_default()
    {
        Assert.IsType<MockCoachAiProvider>(CoachAiProviderFactory.Create(new CoachAiSettings()));
    }

    [Fact]
    public void Factory_returns_vendor_when_selected()
    {
        Assert.IsType<VendorCoachAiProvider>(CoachAiProviderFactory.Create(new CoachAiSettings { Provider = "vendor" }));
    }
}
