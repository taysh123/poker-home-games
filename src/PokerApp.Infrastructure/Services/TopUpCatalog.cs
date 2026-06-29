using PokerApp.Application.Common.Interfaces;
using PokerApp.Infrastructure.Settings;

namespace PokerApp.Infrastructure.Services;

/// <summary>Config-driven top-up catalog. Disabled/empty by default ⇒ Find returns null ⇒ redeem fails closed.</summary>
public sealed class TopUpCatalog(TopUpSettings settings) : ITopUpCatalog
{
    public bool Enabled => settings.Enabled;

    public IReadOnlyList<TopUpBundleDto> Bundles() =>
        settings.Bundles.Select(b => new TopUpBundleDto(b.ProductId, b.Credits)).ToList();

    public TopUpBundleDto? Find(string productId)
    {
        if (!settings.Enabled) return null; // fail closed when the feature is off
        var b = settings.Bundles.FirstOrDefault(x =>
            string.Equals(x.ProductId, productId, StringComparison.Ordinal) && x.Credits > 0);
        return b is null ? null : new TopUpBundleDto(b.ProductId, b.Credits);
    }
}
