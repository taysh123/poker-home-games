namespace PokerApp.Infrastructure.Settings;

/// <summary>
/// Tunable fraud/abuse thresholds (bound from "FraudSettings"). Safe defaults: detection is ALWAYS on
/// (signals + audit), but blocking is OFF (advisory) until thresholds are tuned against real traffic —
/// so we never block legitimate users by default. Flip EnforceBlocking once tuned.
/// </summary>
public class FraudSettings
{
    /// <summary>When false, signals are scored + audited but never block a request.</summary>
    public bool EnforceBlocking { get; init; } = false;

    /// <summary>Distinct accounts allowed to share one device before it's a multi-account signal.</summary>
    public int MaxAccountsPerDevice { get; init; } = 3;

    /// <summary>Velocity window for counting recent AI consumes.</summary>
    public int VelocityWindowSeconds { get; init; } = 60;

    /// <summary>Consumes within the window above which velocity is a signal.</summary>
    public int MaxAnalysesPerWindow { get; init; } = 10;

    /// <summary>Score at/above which a request is blocked (only when EnforceBlocking).</summary>
    public int BlockScore { get; init; } = 100;

    public int MultiAccountWeight { get; init; } = 60;
    public int VelocityWeight { get; init; } = 70;
}
