namespace PokerApp.Application.Common.Interfaces;

/// <summary>
/// Result of creating a Paddle checkout transaction: the hosted checkout URL the client redirects to, and the
/// Paddle transaction id (<c>txn_…</c>) the later verify/webhook flow correlates against.
/// PADDLE-VERIFY (sandbox): the response source for these is <c>data.checkout.url</c> + <c>data.id</c>.
/// </summary>
public sealed record PaddleCheckout(string Url, string TransactionId);

/// <summary>
/// Creates a Paddle Billing checkout (subscription) for a user + plan via <c>POST /transactions</c> (the current
/// Paddle API — NOT Paddle Classic). Returns the checkout URL + transaction id, or null when Paddle is not
/// configured / the API call fails (fail-closed — never fabricates a checkout). The Paddle API key lives
/// server-side only. Implements <see cref="ICheckoutService"/> so it can be the active checkout provider.
/// </summary>
public interface IPaddleCheckoutService : ICheckoutService
{
    Task<PaddleCheckout?> CreateSubscriptionCheckoutAsync(Guid userId, string plan, CancellationToken ct = default);
}
