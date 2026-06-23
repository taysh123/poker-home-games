namespace PokerApp.Application.Common.Interfaces;

/// <summary>
/// Creates a Stripe Checkout session for a subscription plan (web billing). Returns the redirect URL, or null
/// when Stripe is not configured / the API call fails — the caller maps null → BadRequest "billing not
/// configured" (never fabricates a checkout). The Stripe SECRET key lives only in the server implementation.
/// </summary>
public interface IStripeCheckoutService
{
    Task<string?> CreateSubscriptionCheckoutUrlAsync(Guid userId, string plan, CancellationToken ct = default);
}
