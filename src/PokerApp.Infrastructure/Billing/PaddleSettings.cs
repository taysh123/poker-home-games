namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Paddle Billing (web billing — the current Paddle API, NOT Paddle Classic) config, bound from the "Paddle"
/// configuration section. EMPTY by default ⇒ inert / fail-closed: the Stripe path (or the mock) stays active and
/// <see cref="PaddleCheckoutService"/> returns null ("not configured"). Secrets are supplied via env only
/// (Paddle__ApiKey, Paddle__WebhookSigningSecret, Paddle__PriceMonthlyId, Paddle__PriceYearlyId) — never committed.
/// </summary>
public sealed class PaddleSettings
{
    /// <summary>REST API base — sandbox by default: https://sandbox-api.paddle.com → https://api.paddle.com (live).</summary>
    public string ApiBaseUrl { get; init; } = "https://sandbox-api.paddle.com";

    /// <summary>Server API key (pdl_sdbx_apikey_… / pdl_live_apikey_…). Sent as <c>Authorization: Bearer</c>. Secret.</summary>
    public string ApiKey { get; init; } = "";

    /// <summary>Notification-destination signing secret (pdl_ntfset_…) used to verify the Paddle-Signature on webhooks. Secret.</summary>
    public string WebhookSigningSecret { get; init; } = "";

    /// <summary>Paddle price id (pri_…) for the monthly plan.</summary>
    public string PriceMonthlyId { get; init; } = "";

    /// <summary>Paddle price id (pri_…) for the yearly plan.</summary>
    public string PriceYearlyId { get; init; } = "";

    /// <summary>Active only when the API key AND both plan price ids are present (i.e. it can actually open a checkout).</summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ApiKey)
        && !string.IsNullOrWhiteSpace(PriceMonthlyId)
        && !string.IsNullOrWhiteSpace(PriceYearlyId);

    /// <summary>True when the webhook signing secret is present (the verify path can run).</summary>
    public bool WebhookConfigured => !string.IsNullOrWhiteSpace(WebhookSigningSecret);

    /// <summary>Maps a plan ("monthly"/"yearly") to its configured Paddle price id (pri_…), or null if unset.</summary>
    public string? PriceIdFor(string? plan) => plan?.Trim().ToLowerInvariant() switch
    {
        "monthly" or "month" => string.IsNullOrWhiteSpace(PriceMonthlyId) ? null : PriceMonthlyId,
        "yearly" or "year" or "annual" => string.IsNullOrWhiteSpace(PriceYearlyId) ? null : PriceYearlyId,
        _ => null,
    };
}
