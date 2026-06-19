using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Credential-gated stub for the Google Play Developer API (purchases.subscriptionsv2.get).
/// Wired with a service account at DEPLOY; until then returns null (fail-closed). Replace with the
/// real Google.Apis.AndroidPublisher client + integration tests against a sandbox purchase.
/// </summary>
public sealed class GooglePlaySubscriptionsClient : IGooglePlaySubscriptionsClient
{
    public Task<GooglePlaySubscriptionState?> GetAsync(string purchaseToken, CancellationToken ct = default)
        => Task.FromResult<GooglePlaySubscriptionState?>(null); // TODO(deploy): real Play Developer API call
}
