using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;
using Xunit;

namespace PokerApp.Tests;

public class StripeBillingVerifierTests
{
    private static string Session(string subStatus) => JsonSerializer.Serialize(new
    {
        id = "cs_123",
        payment_status = "paid",
        status = "complete",
        livemode = true,
        subscription = new
        {
            id = "sub_123",
            status = subStatus,
            current_period_start = 1_700_000_000L,
            current_period_end = 1_800_000_000L,
            cancel_at_period_end = false,
            items = new { data = new[] { new { price = new { id = "price_monthly" } } } },
        },
    });

    private static StripeBillingVerifier Verifier(HttpStatusCode code, string body, bool configured = true)
        => new(new StripeSettings { SecretKey = configured ? "sk_test" : "" },
               new BillingSettings { Provider = "direct", AcceptSandbox = true },
               new HttpClient(new FakeHttpMessageHandler(code, body)));

    [Fact]
    public async Task Maps_a_paid_active_session_to_a_verified_subscription()
    {
        var result = await Verifier(HttpStatusCode.OK, Session("active")).VerifyAsync(SubscriptionStore.Stripe, "cs_123");
        Assert.NotNull(result);
        Assert.Equal(SubscriptionStore.Stripe, result!.Store);
        Assert.Equal("sub_123", result.OriginalTransactionId);
        Assert.Equal("price_monthly", result.ProductId);
        Assert.Equal(SubscriptionStatus.Active, result.Status);
        Assert.True(result.AutoRenew);
    }

    [Fact]
    public async Task Returns_null_when_not_configured()
        => Assert.Null(await Verifier(HttpStatusCode.OK, Session("active"), configured: false).VerifyAsync(SubscriptionStore.Stripe, "cs_123"));

    [Fact]
    public async Task Returns_null_on_api_error()
        => Assert.Null(await Verifier(HttpStatusCode.InternalServerError, "boom").VerifyAsync(SubscriptionStore.Stripe, "cs_123"));

    [Fact]
    public async Task Returns_null_for_a_non_stripe_store()
        => Assert.Null(await Verifier(HttpStatusCode.OK, Session("active")).VerifyAsync(SubscriptionStore.Apple, "cs_123"));
}
