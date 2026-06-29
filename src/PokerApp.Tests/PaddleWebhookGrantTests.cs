using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Features.Billing.Commands;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// End-to-end Paddle webhook grant: a real signed body → VerifyPaddleAsync → ProcessStoreNotificationCommand.
/// Proves first subscription.created / transaction.completed CREATES the subscription + grants premium; duplicate
/// delivery (same event_id) does NOT double-grant (1 subscription, 1 StoreWebhookEvent); subscription.canceled
/// revokes; a bad signature fails closed (null → the controller answers 401). The webhook is the source of truth.
/// Event JSON shapes ALIGNED to captured sandbox payloads (2026-06-28): subscription.* carry
/// current_billing_period; transaction.* carry billing_period; custom_data.app_user_id sits at the data root.
/// </summary>
public class PaddleWebhookGrantTests
{
    private const string Secret = "pdl_ntfset_test_secret";
    private static readonly DateTime Now = new(2026, 6, 28, 12, 0, 0, DateTimeKind.Utc);

    private static StoreNotificationVerifier Verifier() => new(
        new AppleJwsVerifier([]),
        new FakeOidcKeySource([]),
        new BillingSettings { Provider = "direct", AcceptSandbox = true },
        new GooglePlaySettings(),
        new StripeSettings(),
        new PaddleSettings { WebhookSigningSecret = Secret },
        new RevenueCatSettings());

    /// <summary>Paddle-Signature header for a raw body at <see cref="Now"/> (ts within the verify tolerance).</summary>
    private static string Sign(string body)
    {
        var ts = new DateTimeOffset(Now, TimeSpan.Zero).ToUnixTimeSeconds();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(Secret));
        var mac = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{ts}:{body}"));
        return $"ts={ts};h1={Convert.ToHexString(mac).ToLowerInvariant()}";
    }

    // ends_at is far-future so "active ⇒ premium" assertions don't depend on the machine wall-clock
    // (EntitlementService reads DateTime.UtcNow internally).
    private static string SubscriptionBody(Guid uid, string eventId, string subId, string eventType, string status) =>
        JsonSerializer.Serialize(new
        {
            event_id = eventId,
            event_type = eventType,
            occurred_at = "2026-06-28T12:00:00.000Z",
            notification_id = "ntf_1",
            data = new
            {
                id = subId,
                status,
                current_billing_period = new { starts_at = "2026-06-28T12:00:00Z", ends_at = "2099-07-28T12:00:00Z" },
                items = new[] { new { price = new { id = "pri_monthly" } } },
                custom_data = new { app_user_id = uid.ToString() },
            },
        });

    private static string TransactionBody(Guid uid, string eventId, string subId) =>
        JsonSerializer.Serialize(new
        {
            event_id = eventId,
            event_type = "transaction.completed",
            occurred_at = "2026-06-28T12:00:00.000Z",
            notification_id = "ntf_2",
            data = new
            {
                id = "txn_1",
                status = "completed",
                subscription_id = subId, // transaction.* carries the sub id here (not at data.id)
                billing_period = new { starts_at = "2026-06-28T12:00:00Z", ends_at = "2099-07-28T12:00:00Z" }, // real txn shape: billing_period, NOT current_billing_period
                items = new[] { new { price = new { id = "pri_monthly" } } },
                custom_data = new { app_user_id = uid.ToString() },
            },
        });

    [Fact]
    public async Task First_subscription_created_event_creates_subscription_and_grants_premium()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var body = SubscriptionBody(uid, "evt_1", "sub_1", "subscription.created", "active");

        var dto = await Verifier().VerifyPaddleAsync(body, Sign(body), Now);
        Assert.NotNull(dto);
        Assert.Equal("evt_1", dto!.NotificationUuid);
        Assert.Equal("sub_1", dto.OriginalTransactionId);
        Assert.Equal(uid, dto.UserId);
        Assert.Equal("pri_monthly", dto.ProductId);
        Assert.Equal("renew", dto.Type);

        var handler = new ProcessStoreNotificationCommandHandler(ctx, new CapturingAuditLog());
        await handler.Handle(new ProcessStoreNotificationCommand("paddle", dto), default);

        Assert.Equal(1, await ctx.Subscriptions.CountAsync());
        Assert.True((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);
    }

    [Fact]
    public async Task Transaction_completed_event_creates_subscription_and_grants_premium()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var body = TransactionBody(uid, "evt_2", "sub_2");

        var dto = await Verifier().VerifyPaddleAsync(body, Sign(body), Now);
        Assert.NotNull(dto);
        Assert.Equal("sub_2", dto!.OriginalTransactionId); // resolved from data.subscription_id, not data.id (txn_1)
        Assert.Equal("renew", dto.Type);
        Assert.Equal(uid, dto.UserId);
        // Period must come from data.billing_period on transaction.* (would be null if we only read current_billing_period).
        Assert.Equal(new DateTime(2099, 7, 28, 12, 0, 0, DateTimeKind.Utc), dto.PeriodEnd);

        var handler = new ProcessStoreNotificationCommandHandler(ctx, new CapturingAuditLog());
        await handler.Handle(new ProcessStoreNotificationCommand("paddle", dto), default);

        Assert.Equal(1, await ctx.Subscriptions.CountAsync());
        Assert.True((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);
    }

    [Fact]
    public async Task Duplicate_delivery_same_event_id_does_not_double_grant()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var body = SubscriptionBody(uid, "evt_1", "sub_1", "subscription.created", "active");
        var header = Sign(body);
        var handler = new ProcessStoreNotificationCommandHandler(ctx, new CapturingAuditLog());

        var dto1 = await Verifier().VerifyPaddleAsync(body, header, Now);
        await handler.Handle(new ProcessStoreNotificationCommand("paddle", dto1!), default);
        var dto2 = await Verifier().VerifyPaddleAsync(body, header, Now); // at-least-once re-delivery (same event_id)
        await handler.Handle(new ProcessStoreNotificationCommand("paddle", dto2!), default);

        Assert.Equal(1, await ctx.Subscriptions.CountAsync());      // single subscription
        Assert.Equal(1, await ctx.StoreWebhookEvents.CountAsync()); // deduped on event_id
        Assert.True((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);
    }

    [Fact]
    public async Task Subscription_canceled_event_revokes_premium()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        ctx.Subscriptions.Add(Subscription.Create(uid, SubscriptionStore.Paddle, "pri_monthly", "sub_1",
            Now.AddDays(-1), new DateTime(2099, 7, 28, 12, 0, 0, DateTimeKind.Utc), true, false, Now.AddHours(-1)));
        await ctx.SaveChangesAsync();
        Assert.True((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);

        var body = SubscriptionBody(uid, "evt_cancel", "sub_1", "subscription.canceled", "canceled");
        var dto = await Verifier().VerifyPaddleAsync(body, Sign(body), Now);
        Assert.Equal("expire", dto!.Type); // terminal cancel ⇒ revoke (see MapPaddle)

        var handler = new ProcessStoreNotificationCommandHandler(ctx, new CapturingAuditLog());
        await handler.Handle(new ProcessStoreNotificationCommand("paddle", dto), default);

        Assert.False((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);
    }

    [Fact]
    public async Task Subscription_updated_to_canceled_status_revokes_premium()
    {
        // Real sandbox shape (2026-06-28): an immediate cancel fires subscription.updated with status already
        // "canceled" (scheduled_change null, current_billing_period null) → MapPaddleUpdated → "expire" → revoke.
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        ctx.Subscriptions.Add(Subscription.Create(uid, SubscriptionStore.Paddle, "pri_monthly", "sub_1",
            Now.AddDays(-1), new DateTime(2099, 7, 28, 12, 0, 0, DateTimeKind.Utc), true, false, Now.AddHours(-1)));
        await ctx.SaveChangesAsync();
        Assert.True((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);

        var body = SubscriptionBody(uid, "evt_upd_cancel", "sub_1", "subscription.updated", "canceled");
        var dto = await Verifier().VerifyPaddleAsync(body, Sign(body), Now);
        Assert.Equal("expire", dto!.Type);

        var handler = new ProcessStoreNotificationCommandHandler(ctx, new CapturingAuditLog());
        await handler.Handle(new ProcessStoreNotificationCommand("paddle", dto), default);
        Assert.False((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);
    }

    [Fact]
    public async Task Bad_signature_fails_closed_to_null()
    {
        var uid = Guid.NewGuid();
        var body = SubscriptionBody(uid, "evt_1", "sub_1", "subscription.created", "active");
        Assert.Null(await Verifier().VerifyPaddleAsync(body, "ts=1782993600;h1=deadbeef", Now)); // wrong MAC
        Assert.Null(await Verifier().VerifyPaddleAsync(body, null, Now));                          // missing header
    }
}
