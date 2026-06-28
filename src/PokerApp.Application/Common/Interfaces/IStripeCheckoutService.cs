namespace PokerApp.Application.Common.Interfaces;

/// <summary>
/// Creates a Stripe Checkout session for a subscription plan (web billing). Returns the redirect URL, or null
/// when Stripe is not configured / the API call fails — the caller maps null → BadRequest "billing not
/// configured" (never fabricates a checkout). The Stripe SECRET key lives only in the server implementation.
/// Extends <see cref="ICheckoutService"/> so Stripe can be the active checkout provider when Paddle is absent;
/// the <c>CreateSubscriptionCheckoutUrlAsync</c> method is inherited (same signature).
/// </summary>
public interface IStripeCheckoutService : ICheckoutService
{
}
