using System;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// AI Coach provider config (bound from "CoachAiSettings"). Selects the server-side AI provider and holds the
/// vendor key. The key lives ONLY here, on the SERVER (config/env: <c>CoachAiSettings__ApiKey</c>) — NEVER on
/// the client. Default is the deterministic mock, so dev/tests and prod-with-flags-off are unchanged and
/// fail-closed. Mirrors the billing provider config switch (<see cref="Billing.BillingSettings"/>).
/// </summary>
public class CoachAiSettings
{
    /// <summary>"mock" (default, deterministic demo) | "anthropic" (real Anthropic adapter; requires <see cref="ApiKey"/>) | "vendor" (generic stub).</summary>
    public string Provider { get; init; } = "mock";

    /// <summary>Vendor API key — supplied via config/env, never the client. Null/blank ⇒ the adapter fails closed.</summary>
    public string? ApiKey { get; init; }

    /// <summary>Optional model id (e.g. "claude-sonnet-4-6"); the adapter applies a default if null/blank.</summary>
    public string? Model { get; init; }

    /// <summary>Vendor API base URL (overridable; defaults to the Anthropic API). Not a secret.</summary>
    public string ApiBase { get; init; } = "https://api.anthropic.com";

    /// <summary>True when the real Anthropic adapter is selected (case-insensitive).</summary>
    public bool UseAnthropic => string.Equals(Provider, "anthropic", StringComparison.OrdinalIgnoreCase);

    /// <summary>True when the generic vendor stub is selected (case-insensitive).</summary>
    public bool UseVendor => string.Equals(Provider, "vendor", StringComparison.OrdinalIgnoreCase);

    /// <summary>True when a vendor key is present (non-blank).</summary>
    public bool HasApiKey => !string.IsNullOrWhiteSpace(ApiKey);
}
