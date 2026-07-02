using System;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Billing.Commands.VerifySession;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;
using PokerApp.Infrastructure.Persistence;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Audit H2: the Paddle verify-session grant must be BOUND to the authenticated caller — a user must not be
/// able to claim premium from a transaction id (leaked in the ?_ptxn= redirect URL) they did not pay for.
/// The verifier surfaces custom_data.app_user_id; the handler rejects when it is present and != the caller.
/// </summary>
public class SecurityBillingBindingTests
{
    private static string Transaction(string? appUserId) => JsonSerializer.Serialize(new
    {
        data = new
        {
            id = "txn_123",
            status = "completed",
            subscription_id = "sub_123",
            items = new[] { new { price = new { id = "pri_monthly" } } },
            billing_period = new { starts_at = "2026-06-01T00:00:00Z", ends_at = "2026-07-01T00:00:00Z" },
            custom_data = appUserId is null ? null : new { app_user_id = appUserId },
        },
    });

    private static PaddleBillingVerifier Verifier(string body) => new(
        new PaddleSettings { ApiKey = "pdl_sdbx_apikey_test", PriceMonthlyId = "pri_monthly", PriceYearlyId = "pri_yearly", ApiBaseUrl = "https://sandbox-api.paddle.com" },
        new BillingSettings { Provider = "direct", AcceptSandbox = true },
        new HttpClient(new FakeHttpMessageHandler(HttpStatusCode.OK, body)));

    [Fact]
    public async Task Verifier_surfaces_app_user_id_from_custom_data()
    {
        var result = await Verifier(Transaction("11111111-1111-1111-1111-111111111111"))
            .VerifyAsync(SubscriptionStore.Paddle, "txn_123");
        Assert.Equal("11111111-1111-1111-1111-111111111111", result!.AppUserId);
    }

    private sealed class StubVerifier(VerifiedSubscription? result) : IBillingVerifier
    {
        public Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
            => Task.FromResult(result);
    }

    private static VerifiedSubscription Verified(string? appUserId) => new(
        SubscriptionStore.Paddle, "pri_monthly", "sub_abc", DateTime.UtcNow, DateTime.UtcNow.AddMonths(1),
        AutoRenew: true, IsSandbox: true, Status: SubscriptionStatus.Active, AppUserId: appUserId);

    private static VerifyCheckoutSessionCommandHandler Handler(AppDbContext ctx, IBillingVerifier verifier, Guid caller) =>
        new(verifier, ctx, new EntitlementService(ctx), new CapturingAuditLog(), new FakeCurrentUser(caller));

    [Fact]
    public async Task Rejects_a_transaction_belonging_to_another_user()
    {
        using var ctx = TestInfra.NewContext();
        var caller = Guid.NewGuid();
        var handler = Handler(ctx, new StubVerifier(Verified(Guid.NewGuid().ToString())), caller); // txn owned by someone else
        await Assert.ThrowsAsync<BadRequestException>(() =>
            handler.Handle(new VerifyCheckoutSessionCommand("txn_abc"), default));
        Assert.Equal(0, await ctx.Subscriptions.CountAsync()); // nothing granted
    }

    [Fact]
    public async Task Grants_when_the_transaction_names_the_caller()
    {
        using var ctx = TestInfra.NewContext();
        var caller = Guid.NewGuid();
        var handler = Handler(ctx, new StubVerifier(Verified(caller.ToString())), caller);
        var ent = await handler.Handle(new VerifyCheckoutSessionCommand("txn_abc"), default);
        Assert.True(ent.IsPremium);
    }

    [Fact]
    public async Task Grants_when_no_app_user_id_is_present_backward_compatible()
    {
        using var ctx = TestInfra.NewContext();
        var caller = Guid.NewGuid();
        var handler = Handler(ctx, new StubVerifier(Verified(null)), caller);
        var ent = await handler.Handle(new VerifyCheckoutSessionCommand("txn_abc"), default);
        Assert.True(ent.IsPremium);
    }
}
