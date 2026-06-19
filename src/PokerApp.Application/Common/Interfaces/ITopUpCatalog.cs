namespace PokerApp.Application.Common.Interfaces;

/// <summary>A configured consumable AI-credit bundle (no live billing yet).</summary>
public sealed record TopUpBundleDto(string ProductId, int Credits);

/// <summary>
/// Config-driven catalog of top-up bundles. Empty/disabled by default ⇒ redeem fails closed.
/// Bridges Infrastructure config to Application handlers (mirrors IAiCreditPolicyProvider).
/// </summary>
public interface ITopUpCatalog
{
    bool Enabled { get; }
    IReadOnlyList<TopUpBundleDto> Bundles();
    TopUpBundleDto? Find(string productId);
}
