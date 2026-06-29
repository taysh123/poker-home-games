namespace PokerApp.Application.Common.Interfaces;

/// <summary>AI credit policy for a tier. Kind: "lifetime" (free taste) or "monthly" (premium quota).</summary>
public sealed record AiCreditPolicy(string Kind, int Credits, int MinIntervalSeconds);

/// <summary>
/// Resolves the configurable AI credit policy per tier. Quotas are server config so they can
/// change without a schema change; future tiers extend here.
/// </summary>
public interface IAiCreditPolicyProvider
{
    /// <param name="tier">"free" or "premium".</param>
    AiCreditPolicy ForTier(string tier);
}
