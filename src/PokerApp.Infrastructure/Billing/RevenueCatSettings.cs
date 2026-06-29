namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// RevenueCat (mobile aggregator) config, bound from "RevenueCatSettings". EMPTY by default ⇒ inert /
/// fail-closed. The SECRET REST key + the webhook Authorization-header value are supplied via env only
/// (RevenueCatSettings__SecretApiKey, __WebhookAuthHeader) — never committed. The client uses a separate
/// PUBLIC SDK key, which lives on the client, not here.
/// </summary>
public sealed class RevenueCatSettings
{
    public string SecretApiKey { get; init; } = "";
    public string WebhookAuthHeader { get; init; } = "";
    public string ApiBase { get; init; } = "https://api.revenuecat.com";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(SecretApiKey);
    public bool WebhookConfigured => !string.IsNullOrWhiteSpace(WebhookAuthHeader);
}
