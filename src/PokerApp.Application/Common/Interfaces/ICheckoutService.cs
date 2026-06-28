namespace PokerApp.Application.Common.Interfaces;

/// <summary>
/// Provider-agnostic web-checkout seam. The active implementation is selected at composition time — Paddle when
/// it is configured, otherwise the existing Stripe path. Returns the hosted checkout URL, or null when the active
/// provider is unconfigured / the API call fails. The caller maps null → BadRequest "billing not configured"
/// (never fabricates a checkout). Provider secrets live only in the server implementations.
/// </summary>
public interface ICheckoutService
{
    Task<string?> CreateSubscriptionCheckoutUrlAsync(Guid userId, string plan, CancellationToken ct = default);
}
