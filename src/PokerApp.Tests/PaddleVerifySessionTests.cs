using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Billing.Commands.VerifySession;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Pins the Paddle web success-redirect grant (POST /api/billing/verify-session): a paid transaction grants premium
/// and upserts ONE Subscription; it is idempotent with the webhook (no second row when the sub already exists); an
/// unverifiable transaction → BadRequest. The verifier is stubbed (HTTP is covered by PaddleBillingVerifierTests).
/// Mirrors the Stripe plan Task 6, Paddle-fixed.
/// </summary>
public class PaddleVerifySessionTests
{
    // The stubbed transactions are sandbox (IsSandbox: true) — entitlement checks need the explicit dev-seam opt-in.
    private static readonly BillingSettings AcceptSandbox = new() { AcceptSandbox = true };

    private sealed class StubVerifier(VerifiedSubscription? result) : IBillingVerifier
    {
        public Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
            => Task.FromResult(result);
    }

    private static VerifiedSubscription Paid() => new(
        SubscriptionStore.Paddle, "pri_monthly", "sub_abc",
        DateTime.UtcNow, DateTime.UtcNow.AddMonths(1), AutoRenew: true, IsSandbox: true, Status: SubscriptionStatus.Active);

    [Fact]
    public async Task Paid_transaction_grants_premium_and_upserts_one_subscription()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var handler = new VerifyCheckoutSessionCommandHandler(
            new StubVerifier(Paid()), ctx, new EntitlementService(ctx, AcceptSandbox), new CapturingAuditLog(), new FakeCurrentUser(uid));

        var ent = await handler.Handle(new VerifyCheckoutSessionCommand("txn_abc"), default);

        Assert.True(ent.IsPremium);
        Assert.Equal(1, await ctx.Subscriptions.CountAsync());
    }

    [Fact]
    public async Task Verify_is_idempotent_with_the_webhook_no_second_row()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        // Simulate the webhook already created the same Paddle sub (keyed by Store + OriginalTransactionId).
        ctx.Subscriptions.Add(PokerApp.Domain.Entities.Subscription.Create(
            uid, SubscriptionStore.Paddle, "pri_monthly", "sub_abc",
            DateTime.UtcNow, DateTime.UtcNow.AddMonths(1), true, true, DateTime.UtcNow));
        await ctx.SaveChangesAsync();

        var handler = new VerifyCheckoutSessionCommandHandler(
            new StubVerifier(Paid()), ctx, new EntitlementService(ctx, AcceptSandbox), new CapturingAuditLog(), new FakeCurrentUser(uid));
        var ent = await handler.Handle(new VerifyCheckoutSessionCommand("txn_abc"), default);

        Assert.True(ent.IsPremium);
        Assert.Equal(1, await ctx.Subscriptions.CountAsync()); // upserted, not duplicated
    }

    [Fact]
    public async Task Unverifiable_transaction_throws_bad_request()
    {
        using var ctx = TestInfra.NewContext();
        var handler = new VerifyCheckoutSessionCommandHandler(
            new StubVerifier(null), ctx, new EntitlementService(ctx), new CapturingAuditLog(), new FakeCurrentUser(Guid.NewGuid()));
        await Assert.ThrowsAsync<BadRequestException>(() =>
            handler.Handle(new VerifyCheckoutSessionCommand("txn_bad"), default));
    }
}
