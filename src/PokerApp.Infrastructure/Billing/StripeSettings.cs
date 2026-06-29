namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Stripe (web billing) config, bound from "StripeSettings". EMPTY by default ⇒ inert / fail-closed (the mock
/// verifier stays active and checkout returns "not configured"). Secrets are supplied via env only
/// (StripeSettings__SecretKey, __WebhookSecret, __PriceMonthlyId, __PriceYearlyId) — never committed.
/// </summary>
public sealed class StripeSettings
{
    public string SecretKey { get; init; } = "";
    public string WebhookSecret { get; init; } = "";
    public string PriceMonthlyId { get; init; } = "";
    public string PriceYearlyId { get; init; } = "";
    public string ApiBase { get; init; } = "https://api.stripe.com";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(SecretKey);
    public bool WebhookConfigured => !string.IsNullOrWhiteSpace(WebhookSecret);

    /// <summary>Maps a plan ("monthly"/"yearly") to its configured Stripe Price id, or null if unset.</summary>
    public string? PriceIdFor(string? plan) => plan?.Trim().ToLowerInvariant() switch
    {
        "monthly" or "month" => string.IsNullOrWhiteSpace(PriceMonthlyId) ? null : PriceMonthlyId,
        "yearly" or "year" or "annual" => string.IsNullOrWhiteSpace(PriceYearlyId) ? null : PriceYearlyId,
        _ => null,
    };
}
