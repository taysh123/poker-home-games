namespace PokerApp.Infrastructure.Identity;

/// <summary>Configurable AI credit policy per tier (bound from "AiCreditSettings").
/// Changing quotas needs NO schema change. Profit-protective defaults.</summary>
public class AiCreditPolicySettings
{
    public string Kind { get; init; } = "lifetime";  // "lifetime" | "monthly"
    public int Credits { get; init; }
    public int MinIntervalSeconds { get; init; } = 2;
}

public class AiCreditSettings
{
    public AiCreditPolicySettings Free { get; init; } = new() { Kind = "lifetime", Credits = 1, MinIntervalSeconds = 4 };
    public AiCreditPolicySettings Premium { get; init; } = new() { Kind = "monthly", Credits = 100, MinIntervalSeconds = 2 };
}
