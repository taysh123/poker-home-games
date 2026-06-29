using System;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Pins the Paddle verify-session HTTP path (GET /transactions/{id}): a completed subscription transaction maps to
/// a VerifiedSubscription keyed by the SUBSCRIPTION id; fail-closed on unconfigured / API error / wrong store /
/// missing subscription_id / non-paid status. Mirrors <see cref="StripeBillingVerifierTests"/>.
/// PADDLE-VERIFY (sandbox): the transaction JSON shape below is from the research doc, not a captured call.
/// </summary>
public class PaddleBillingVerifierTests
{
    private static string Transaction(string status, bool withSubscription = true) => JsonSerializer.Serialize(new
    {
        data = new
        {
            id = "txn_123",
            status,
            subscription_id = withSubscription ? "sub_123" : null,
            items = new[] { new { price = new { id = "pri_monthly" } } },
            billing_period = new { starts_at = "2026-06-01T00:00:00Z", ends_at = "2026-07-01T00:00:00Z" },
        },
    });

    private static PaddleBillingVerifier Verifier(HttpStatusCode code, string body, bool configured = true)
        => new(new PaddleSettings
               {
                   ApiKey = configured ? "pdl_sdbx_apikey_test" : "",
                   PriceMonthlyId = "pri_monthly",
                   PriceYearlyId = "pri_yearly",
                   ApiBaseUrl = "https://sandbox-api.paddle.com",
               },
               new BillingSettings { Provider = "direct", AcceptSandbox = true },
               new HttpClient(new FakeHttpMessageHandler(code, body)));

    [Fact]
    public async Task Maps_a_completed_subscription_transaction_to_a_verified_subscription()
    {
        var result = await Verifier(HttpStatusCode.OK, Transaction("completed")).VerifyAsync(SubscriptionStore.Paddle, "txn_123");
        Assert.NotNull(result);
        Assert.Equal(SubscriptionStore.Paddle, result!.Store);
        Assert.Equal("sub_123", result.OriginalTransactionId); // the SUBSCRIPTION id, not the txn id
        Assert.Equal("pri_monthly", result.ProductId);
        Assert.Equal(SubscriptionStatus.Active, result.Status);
        Assert.True(result.IsSandbox);
        Assert.Equal(new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc), result.PeriodEnd);
    }

    [Fact]
    public async Task Sends_bearer_auth_to_the_transactions_endpoint()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, Transaction("completed"));
        var verifier = new PaddleBillingVerifier(
            new PaddleSettings { ApiKey = "pdl_sdbx_apikey_test", PriceMonthlyId = "pri_monthly", PriceYearlyId = "pri_yearly", ApiBaseUrl = "https://sandbox-api.paddle.com" },
            new BillingSettings { Provider = "direct", AcceptSandbox = true },
            new HttpClient(handler));

        await verifier.VerifyAsync(SubscriptionStore.Paddle, "txn_123");

        Assert.Equal(HttpMethod.Get, handler.LastRequest!.Method);
        Assert.EndsWith("/transactions/txn_123", handler.LastRequest.RequestUri!.AbsolutePath);
        Assert.Equal("Bearer", handler.LastRequest.Headers.Authorization!.Scheme);
        Assert.Equal("pdl_sdbx_apikey_test", handler.LastRequest.Headers.Authorization.Parameter);
    }

    [Fact]
    public async Task Returns_null_when_not_configured()
        => Assert.Null(await Verifier(HttpStatusCode.OK, Transaction("completed"), configured: false).VerifyAsync(SubscriptionStore.Paddle, "txn_123"));

    [Fact]
    public async Task Returns_null_on_api_error()
        => Assert.Null(await Verifier(HttpStatusCode.InternalServerError, "boom").VerifyAsync(SubscriptionStore.Paddle, "txn_123"));

    [Fact]
    public async Task Returns_null_for_a_non_paddle_store()
        => Assert.Null(await Verifier(HttpStatusCode.OK, Transaction("completed")).VerifyAsync(SubscriptionStore.Stripe, "txn_123"));

    [Fact]
    public async Task Returns_null_for_a_non_paid_transaction()
        => Assert.Null(await Verifier(HttpStatusCode.OK, Transaction("draft")).VerifyAsync(SubscriptionStore.Paddle, "txn_123"));

    [Fact]
    public async Task Returns_null_for_a_one_time_transaction_without_subscription()
        => Assert.Null(await Verifier(HttpStatusCode.OK, Transaction("completed", withSubscription: false)).VerifyAsync(SubscriptionStore.Paddle, "txn_123"));
}
