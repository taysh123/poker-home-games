using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;
using Xunit;

namespace PokerApp.Tests;

/// <summary>Proves DirectBillingVerifier routes each store to its verifier (so a future mis-wire breaks a test).</summary>
public class DirectBillingVerifierDispatchTests
{
    private static string StripeSession() => JsonSerializer.Serialize(new
    {
        id = "cs_123",
        payment_status = "paid",
        status = "complete",
        livemode = true,
        subscription = new
        {
            id = "sub_123",
            status = "active",
            current_period_start = 1_700_000_000L,
            current_period_end = 1_800_000_000L,
            cancel_at_period_end = false,
            items = new { data = new[] { new { price = new { id = "price_monthly" } } } },
        },
    });

    [Fact]
    public async Task Routes_each_store_to_its_verifier()
    {
        var billing = new BillingSettings { Provider = "direct", AcceptSandbox = true };
        var stripe = new StripeBillingVerifier(
            new StripeSettings { SecretKey = "sk_test" }, billing,
            new HttpClient(new FakeHttpMessageHandler(HttpStatusCode.OK, StripeSession())));
        var direct = new DirectBillingVerifier(
            new AppleBillingVerifier(new AppleJwsVerifier([]), billing),              // fail-closed (no roots)
            new GooglePlayBillingVerifier(new FakeGooglePlayClient(null), billing),  // fail-closed (null state)
            stripe,
            new RevenueCatBillingVerifier(new RevenueCatSettings(), billing,         // unconfigured → null
                new HttpClient(new FakeHttpMessageHandler(HttpStatusCode.OK, "{}"))),
            new PaddleBillingVerifier(new PaddleSettings(), billing,                  // unconfigured → null
                new HttpClient(new FakeHttpMessageHandler(HttpStatusCode.OK, "{}"))));

        // Stripe routes to the configured stripe verifier → a real result.
        var stripeResult = await direct.VerifyAsync(SubscriptionStore.Stripe, "cs_123");
        Assert.NotNull(stripeResult);
        Assert.Equal(SubscriptionStore.Stripe, stripeResult!.Store);

        // Other stores route to their (fail-closed) verifiers → null, never the stripe result.
        Assert.Null(await direct.VerifyAsync(SubscriptionStore.Apple, "not-a-jws"));
        Assert.Null(await direct.VerifyAsync(SubscriptionStore.Google, "tok"));
        Assert.Null(await direct.VerifyAsync(SubscriptionStore.RevenueCat, "user_1"));
        Assert.Null(await direct.VerifyAsync(SubscriptionStore.Paddle, "txn_1"));
    }
}
