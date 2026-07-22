namespace PokerApp.Infrastructure.Billing;

/// <summary>Which IBillingVerifier implementation DI should register.</summary>
public enum BillingVerifierKind
{
    Direct,
    Mock,
    Disabled,
}

/// <summary>
/// Pure, test-pinned verifier selection (same pattern as RateLimitKeys: logic here, DI supplies inputs).
/// Fail-closed: in Production, anything other than an explicit "direct" provider resolves to the DISABLED
/// verifier — the mock (which grants premium for ANY non-empty receipt) is a dev/test-only seam and must be
/// unreachable in prod regardless of env-var state.
/// </summary>
public static class BillingVerifierSelection
{
    public static BillingVerifierKind Resolve(string? provider, bool isProduction)
    {
        if (string.Equals(provider, "direct", StringComparison.OrdinalIgnoreCase))
            return BillingVerifierKind.Direct;
        return isProduction ? BillingVerifierKind.Disabled : BillingVerifierKind.Mock;
    }
}
