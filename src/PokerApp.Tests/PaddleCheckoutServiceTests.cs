using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using PokerApp.Infrastructure.Billing;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Pins the Paddle Billing checkout-transaction creation (POST /transactions): the request shape (price id +
/// custom_data.app_user_id, Bearer auth) and the defensive response parsing (data.checkout.url + data.id).
/// Fail-closed on unconfigured / unknown plan / API error. Mirrors <see cref="StripeBillingVerifierTests"/>.
/// </summary>
public class PaddleCheckoutServiceTests
{
    private const string ApiKey = "pdl_sdbx_apikey_testkey_000";

    private static PaddleSettings Settings(bool configured = true) => new()
    {
        ApiKey = configured ? ApiKey : "",
        PriceMonthlyId = "pri_monthly",
        PriceYearlyId = "pri_yearly",
        ApiBaseUrl = "https://sandbox-api.paddle.com",
    };

    private static PaddleCheckoutService Service(FakeHttpMessageHandler handler, bool configured = true)
        => new(Settings(configured), new HttpClient(handler));

    [Fact]
    public async Task Creates_a_transaction_and_returns_the_checkout_url()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK,
            "{\"data\":{\"id\":\"txn_01abc\",\"checkout\":{\"url\":\"https://sandbox-checkout.paddle.com/?_ptxn=txn_01abc\"}}}");
        var userId = Guid.NewGuid();

        var result = await Service(handler).CreateSubscriptionCheckoutAsync(userId, "yearly");

        Assert.NotNull(result);
        Assert.Equal("https://sandbox-checkout.paddle.com/?_ptxn=txn_01abc", result!.Url);
        Assert.Equal("txn_01abc", result.TransactionId);

        // Hits POST /transactions on the Paddle base URL.
        Assert.Equal(HttpMethod.Post, handler.LastRequest!.Method);
        Assert.EndsWith("/transactions", handler.LastRequest.RequestUri!.AbsolutePath);

        // Bearer auth with the server API key.
        Assert.Equal("Bearer", handler.LastRequest.Headers.Authorization!.Scheme);
        Assert.Equal(ApiKey, handler.LastRequest.Headers.Authorization.Parameter);

        // Body carries the plan's price id + the app_user_id custom data (captured at send time).
        var body = handler.LastRequestBody!;
        Assert.Contains("price_id", body);
        Assert.Contains("pri_yearly", body);
        Assert.Contains("custom_data", body);
        Assert.Contains("app_user_id", body);
        Assert.Contains(userId.ToString(), body);
    }

    [Fact]
    public async Task Returns_null_when_not_configured()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK,
            "{\"data\":{\"id\":\"txn_x\",\"checkout\":{\"url\":\"https://x\"}}}");
        Assert.Null(await Service(handler, configured: false).CreateSubscriptionCheckoutAsync(Guid.NewGuid(), "monthly"));
    }

    [Fact]
    public async Task Returns_null_on_paddle_api_error()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.BadRequest, "{\"error\":{\"detail\":\"boom\"}}");
        Assert.Null(await Service(handler).CreateSubscriptionCheckoutAsync(Guid.NewGuid(), "monthly"));
    }

    [Fact]
    public async Task Returns_null_for_an_unknown_plan()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK,
            "{\"data\":{\"id\":\"txn_x\",\"checkout\":{\"url\":\"https://x\"}}}");
        Assert.Null(await Service(handler).CreateSubscriptionCheckoutAsync(Guid.NewGuid(), "lifetime"));
    }

    [Fact]
    public async Task Returns_null_when_the_response_has_no_checkout_url()
    {
        // Defensive parsing: a 200 whose data lacks checkout.url must not fabricate a checkout.
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, "{\"data\":{\"id\":\"txn_x\"}}");
        Assert.Null(await Service(handler).CreateSubscriptionCheckoutAsync(Guid.NewGuid(), "monthly"));
    }
}
