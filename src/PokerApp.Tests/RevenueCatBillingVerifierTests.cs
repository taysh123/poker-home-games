using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;
using Xunit;

namespace PokerApp.Tests;

public class RevenueCatBillingVerifierTests
{
    private static string Subscriber(string expiresIso) => JsonSerializer.Serialize(new
    {
        subscriber = new
        {
            original_app_user_id = "user_1",
            entitlements = new Dictionary<string, object>
            {
                ["premium"] = new { expires_date = expiresIso, product_identifier = "tpoker.premium.monthly" },
            },
            subscriptions = new Dictionary<string, object>
            {
                ["tpoker.premium.monthly"] = new { purchase_date = "2026-06-01T00:00:00Z", is_sandbox = false },
            },
        },
    });

    private static RevenueCatBillingVerifier Verifier(HttpStatusCode code, string body, bool configured = true)
        => new(new RevenueCatSettings { SecretApiKey = configured ? "sk_rc" : "" },
               new BillingSettings { Provider = "direct", AcceptSandbox = true },
               new HttpClient(new FakeHttpMessageHandler(code, body)));

    [Fact]
    public async Task Maps_an_active_entitlement_to_a_verified_subscription()
    {
        var result = await Verifier(HttpStatusCode.OK, Subscriber("2999-01-01T00:00:00Z")).VerifyAsync(SubscriptionStore.RevenueCat, "user_1");
        Assert.NotNull(result);
        Assert.Equal(SubscriptionStore.RevenueCat, result!.Store);
        Assert.Equal("user_1", result.OriginalTransactionId);
        Assert.Equal("tpoker.premium.monthly", result.ProductId);
        Assert.Equal(SubscriptionStatus.Active, result.Status);
    }

    [Fact]
    public async Task Returns_null_when_entitlement_is_expired()
        => Assert.Null(await Verifier(HttpStatusCode.OK, Subscriber("2000-01-01T00:00:00Z")).VerifyAsync(SubscriptionStore.RevenueCat, "user_1"));

    [Fact]
    public async Task Returns_null_when_not_configured()
        => Assert.Null(await Verifier(HttpStatusCode.OK, Subscriber("2999-01-01T00:00:00Z"), configured: false).VerifyAsync(SubscriptionStore.RevenueCat, "user_1"));

    [Fact]
    public async Task Returns_null_on_api_error()
        => Assert.Null(await Verifier(HttpStatusCode.NotFound, "{}").VerifyAsync(SubscriptionStore.RevenueCat, "user_1"));
}
