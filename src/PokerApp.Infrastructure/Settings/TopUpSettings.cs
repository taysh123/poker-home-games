namespace PokerApp.Infrastructure.Settings;

/// <summary>A configured consumable AI-credit bundle.</summary>
public class TopUpBundleSettings
{
    public string ProductId { get; init; } = string.Empty;
    public int Credits { get; init; }
}

/// <summary>
/// Top-up bundle config (bound from "TopUpSettings"). Default: DISABLED + empty ⇒ every redeem fails
/// closed. No live billing — consumable receipt verification is a deploy-time seam (see RedeemTopUp).
/// </summary>
public class TopUpSettings
{
    public bool Enabled { get; init; } = false;
    public TopUpBundleSettings[] Bundles { get; init; } = [];
}
