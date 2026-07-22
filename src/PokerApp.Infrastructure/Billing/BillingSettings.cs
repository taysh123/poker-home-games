namespace PokerApp.Infrastructure.Billing;

/// <summary>Central billing config (bound from "BillingSettings"). No hardcoded business values.</summary>
public class BillingSettings
{
    /// <summary>"mock" (dev/tests) or "direct" (real Apple/Google verification).</summary>
    public string Provider { get; init; } = "mock";

    /// <summary>Accept sandbox/TestFlight receipts + notifications. Fail-closed default: sandbox is
    /// OPT-IN (dev appsettings.json sets true explicitly) so a missing config section can never let
    /// sandbox receipts grant production entitlements.</summary>
    public bool AcceptSandbox { get; init; } = false;
}

public class AppleStoreSettings
{
    public string[] BundleIds { get; init; } = [];
    /// <summary>Trusted Apple root certificate(s), PEM. Empty ⇒ Apple verification fails closed.</summary>
    public string[] RootCertsPem { get; init; } = [];
}

public class GooglePlaySettings
{
    public string PackageName { get; init; } = string.Empty;
    /// <summary>Expected audience of the Pub/Sub push OIDC token.</summary>
    public string PubSubAudience { get; init; } = string.Empty;
    /// <summary>Play Developer API service account JSON (deploy secret). Null ⇒ network client stubbed.</summary>
    public string? ServiceAccountJson { get; init; }
}
