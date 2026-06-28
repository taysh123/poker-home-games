using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Billing.Commands;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Verifies SIGNED store webhooks and normalizes them to StoreNotificationDto. Apple: verify the
/// App Store Server Notification V2 JWS + the nested signedTransactionInfo JWS. Google: verify the
/// Pub/Sub push OIDC token, then decode the RTDN. Returns null on any failure / rejected sandbox
/// (fail-closed → the controller responds 401, no state change).
/// </summary>
public sealed class StoreNotificationVerifier(
    AppleJwsVerifier appleJws,
    IOidcKeySource googleKeys,
    BillingSettings billing,
    GooglePlaySettings google,
    StripeSettings stripe,
    PaddleSettings paddle,
    RevenueCatSettings revenueCat) : IStoreNotificationVerifier
{
    public Task<StoreNotificationDto?> VerifyAppleAsync(string signedPayload, DateTime nowUtc, CancellationToken ct = default)
    {
        var outer = appleJws.VerifyAndExtractPayload(signedPayload, nowUtc);
        if (outer is null) return Null();
        try
        {
            using var doc = JsonDocument.Parse(outer);
            var root = doc.RootElement;
            var notificationType = Str(root, "notificationType");
            var subtype = Str(root, "subtype");
            var uuid = Str(root, "notificationUUID");
            var signedDate = Ms(root, "signedDate");

            if (!root.TryGetProperty("data", out var data)) return Null();
            var environment = Str(data, "environment");
            if (string.Equals(environment, "Sandbox", StringComparison.OrdinalIgnoreCase) && !billing.AcceptSandbox)
                return Null(); // sandbox cannot grant production

            var signedTx = Str(data, "signedTransactionInfo");
            if (string.IsNullOrEmpty(signedTx)) return Null();
            var txJson = appleJws.VerifyAndExtractPayload(signedTx, nowUtc);
            if (txJson is null) return Null();

            using var tx = JsonDocument.Parse(txJson);
            var originalTransactionId = Str(tx.RootElement, "originalTransactionId");
            var expiresMs = Ms(tx.RootElement, "expiresDate");
            if (string.IsNullOrEmpty(uuid) || string.IsNullOrEmpty(originalTransactionId)) return Null();

            return Task.FromResult<StoreNotificationDto?>(new StoreNotificationDto(
                uuid, MapApple(notificationType, subtype), originalTransactionId,
                Epoch(signedDate) ?? nowUtc, Epoch(expiresMs)));
        }
        catch { return Null(); }
    }

    public async Task<StoreNotificationDto?> VerifyGoogleAsync(
        string? authorizationHeader, string messageId, string base64Data, DateTime nowUtc, CancellationToken ct = default)
    {
        var token = Bearer(authorizationHeader);
        if (token is null) return null;
        var keys = await googleKeys.GetKeysAsync(ct);
        if (!GoogleOidcVerifier.Verify(token, keys, google.PubSubAudience, nowUtc)) return null;

        try
        {
            var rtdnJson = Encoding.UTF8.GetString(Convert.FromBase64String(base64Data));
            using var doc = JsonDocument.Parse(rtdnJson);
            if (!doc.RootElement.TryGetProperty("subscriptionNotification", out var sn)) return null;
            var purchaseToken = Str(sn, "purchaseToken");
            var type = sn.TryGetProperty("notificationType", out var nt) && nt.TryGetInt32(out var n) ? n : 0;
            if (string.IsNullOrEmpty(purchaseToken) || string.IsNullOrEmpty(messageId)) return null;
            // Authoritative period comes from the Play Developer API (stub) — null until wired at deploy.
            return new StoreNotificationDto(messageId, MapGoogle(type), purchaseToken, nowUtc, null);
        }
        catch { return null; }
    }

    public Task<StoreNotificationDto?> VerifyStripeAsync(string rawPayload, string? stripeSignature, DateTime nowUtc, CancellationToken ct = default)
    {
        if (!stripe.WebhookConfigured || !StripeSignature.Verify(rawPayload, stripeSignature, stripe.WebhookSecret, nowUtc))
            return Null(); // fail-closed: unconfigured or bad signature
        try
        {
            using var doc = JsonDocument.Parse(rawPayload);
            var root = doc.RootElement;
            var eventId = Str(root, "id");
            var type = Str(root, "type");
            if (string.IsNullOrEmpty(eventId) || type.Length == 0) return Null();
            if (!root.TryGetProperty("data", out var data) || !data.TryGetProperty("object", out var obj)) return Null();

            // Subscription events carry the subscription as the object; checkout.session.completed references it.
            var subId = Str(obj, "id");
            if (obj.TryGetProperty("subscription", out var s) && s.ValueKind == JsonValueKind.String)
                subId = s.GetString() ?? subId;
            if (string.IsNullOrEmpty(subId)) return Null();

            return Task.FromResult<StoreNotificationDto?>(new StoreNotificationDto(
                eventId, MapStripe(type, obj), subId,
                EpochSeconds(Ms(root, "created")) ?? nowUtc, EpochSeconds(StripePeriodEnd(obj))));
        }
        catch { return Null(); }
    }

    public Task<StoreNotificationDto?> VerifyPaddleAsync(string rawBody, string? paddleSignature, DateTime nowUtc, CancellationToken ct = default)
    {
        if (!paddle.WebhookConfigured || !PaddleSignature.Verify(rawBody, paddleSignature, paddle.WebhookSigningSecret, nowUtc))
            return Null(); // fail-closed: unconfigured or bad signature
        try
        {
            using var doc = JsonDocument.Parse(rawBody);
            var root = doc.RootElement;

            // Envelope: event_id (idempotency key), event_type ("entity.action"), occurred_at, data (the entity).
            var eventId = Str(root, "event_id");
            var eventType = Str(root, "event_type");
            if (string.IsNullOrEmpty(eventId) || eventType.Length == 0) return Null();
            if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object) return Null();

            // OriginalTransactionId = the SUBSCRIPTION id (sub_…). On subscription.* the data root IS the
            // subscription (data.id = sub_…); on transaction.* the sub id is data.subscription_id.
            // PADDLE-VERIFY (sandbox): confirm this nesting against a captured sandbox event.
            var subId = eventType.StartsWith("transaction.", StringComparison.Ordinal)
                ? Str(data, "subscription_id")
                : Str(data, "id");
            if (string.IsNullOrEmpty(subId)) return Null();

            // Our user link: data.custom_data.app_user_id (set on the checkout, propagated to sub + transaction).
            // PADDLE-VERIFY (sandbox): confirm custom_data sits at the data root on both subscription.* and transaction.*.
            Guid? userId = null;
            if (data.TryGetProperty("custom_data", out var cd) && cd.ValueKind == JsonValueKind.Object
                && Guid.TryParse(Str(cd, "app_user_id"), out var uid)) userId = uid;

            var occurredAt = ParseRfc3339(Str(root, "occurred_at")) ?? nowUtc;

            return Task.FromResult<StoreNotificationDto?>(new StoreNotificationDto(
                eventId, MapPaddle(eventType, data), subId, occurredAt, PaddleBillingPeriod(data, "ends_at"))
            {
                UserId = userId,
                ProductId = PaddleFirstPrice(data),
                PeriodStart = PaddleBillingPeriod(data, "starts_at"),
            });
        }
        catch { return Null(); }
    }

    public Task<StoreNotificationDto?> VerifyRevenueCatAsync(string? authorizationHeader, string rawBody, DateTime nowUtc, CancellationToken ct = default)
    {
        if (!revenueCat.WebhookConfigured || !FixedEquals(authorizationHeader, revenueCat.WebhookAuthHeader))
            return Null(); // fail-closed: unconfigured or wrong shared secret
        try
        {
            using var doc = JsonDocument.Parse(rawBody);
            if (!doc.RootElement.TryGetProperty("event", out var ev)) return Null();
            var id = Str(ev, "id");
            var type = Str(ev, "type");
            var appUserId = Str(ev, "app_user_id");
            if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(appUserId)) return Null();
            return Task.FromResult<StoreNotificationDto?>(new StoreNotificationDto(
                id, MapRevenueCat(type), appUserId, nowUtc, Epoch(Ms(ev, "expiration_at_ms"))));
        }
        catch { return Null(); }
    }

    private static string MapStripe(string type, JsonElement obj) => type switch
    {
        "checkout.session.completed" or "customer.subscription.created" or "invoice.payment_succeeded" => "renew",
        "customer.subscription.deleted" => "expire",
        "invoice.payment_failed" => "grace",
        "customer.subscription.updated" =>
            obj.TryGetProperty("cancel_at_period_end", out var c) && c.ValueKind == JsonValueKind.True ? "cancel" : "renew",
        _ => "unknown",
    };

    // Paddle event → normalized Type. Mirrors the Stripe shape: created/activated/resumed + transaction.completed
    // grant ("renew"); subscription.canceled is TERMINAL (the sub has actually ended) so it REVOKES ("expire",
    // like Stripe customer.subscription.deleted) — a scheduled cancel-at-period-end instead arrives as
    // subscription.updated with status still active + scheduled_change.action="cancel" and RETAINS access until it
    // takes effect; paused/past_due → "grace". subscription.updated is Paddle's catch-all → branch on status.
    // PADDLE-VERIFY (sandbox): confirm event_type spellings + scheduled_change shape against captured events.
    private static string MapPaddle(string eventType, JsonElement data)
    {
        var status = Str(data, "status");
        return eventType switch
        {
            "subscription.created" or "subscription.activated" or "subscription.resumed"
                or "subscription.trialing" or "transaction.completed" or "transaction.paid" => "renew",
            "subscription.canceled" => "expire",
            "subscription.paused" => "grace",
            "subscription.past_due" => "grace",
            "subscription.updated" => MapPaddleUpdated(data, status),
            _ => MapPaddleStatus(status),
        };
    }

    private static string MapPaddleUpdated(JsonElement data, string status)
    {
        // A scheduled cancel-at-period-end keeps status active but sets scheduled_change.action="cancel":
        // retain access until it takes effect (mirrors Stripe cancel_at_period_end → "cancel").
        if (data.TryGetProperty("scheduled_change", out var sc) && sc.ValueKind == JsonValueKind.Object
            && Str(sc, "action") == "cancel")
            return "cancel";
        return MapPaddleStatus(status);
    }

    private static string MapPaddleStatus(string status) => status switch
    {
        "active" or "trialing" => "renew",
        "past_due" or "paused" => "grace",
        "canceled" => "expire",
        _ => "unknown",
    };

    // Subscription item prices are a top-level ARRAY in Paddle (items[0].price.id), unlike Stripe's items.data[].
    private static string PaddleFirstPrice(JsonElement data) =>
        data.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array
        && items.GetArrayLength() > 0 && items[0].TryGetProperty("price", out var price)
            ? Str(price, "id") : "";

    // data.current_billing_period.{starts_at,ends_at} are RFC-3339 strings (null on paused/canceled).
    private static DateTime? PaddleBillingPeriod(JsonElement data, string field) =>
        data.TryGetProperty("current_billing_period", out var p) && p.ValueKind == JsonValueKind.Object
            ? ParseRfc3339(Str(p, field)) : null;

    private static DateTime? ParseRfc3339(string s) =>
        DateTimeOffset.TryParse(s, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal,
            out var dto) ? dto.UtcDateTime : null;

    private static string MapRevenueCat(string type) => type switch
    {
        "INITIAL_PURCHASE" or "RENEWAL" or "PRODUCT_CHANGE" or "UNCANCELLATION" => "renew",
        "CANCELLATION" => "cancel",
        "EXPIRATION" => "expire",
        "BILLING_ISSUE" => "grace",
        "REFUND" => "refund",
        _ => "unknown",
    };

    private static DateTime? EpochSeconds(long s) => s > 0 ? DateTimeOffset.FromUnixTimeSeconds(s).UtcDateTime : null;

    // Newer Stripe API moved current_period_end onto the subscription item; read the sub level first, then items.data[0].
    private static long StripePeriodEnd(JsonElement obj)
    {
        var v = Ms(obj, "current_period_end");
        if (v > 0) return v;
        if (obj.TryGetProperty("items", out var items) && items.TryGetProperty("data", out var data)
            && data.ValueKind == JsonValueKind.Array && data.GetArrayLength() > 0)
            return Ms(data[0], "current_period_end");
        return 0;
    }

    private static bool FixedEquals(string? a, string? b)
    {
        if (a is null || b is null) return false;
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }

    private static Task<StoreNotificationDto?> Null() => Task.FromResult<StoreNotificationDto?>(null);

    private static string MapApple(string type, string subtype) => type switch
    {
        "SUBSCRIBED" or "DID_RENEW" => "renew",
        "DID_CHANGE_RENEWAL_STATUS" => subtype == "AUTO_RENEW_DISABLED" ? "cancel" : "renew",
        "EXPIRED" => "expire",
        "DID_FAIL_TO_RENEW" => "grace",
        "REFUND" => "refund",
        _ => "unknown",
    };

    private static string MapGoogle(int type) => type switch
    {
        2 => "renew", 3 => "cancel", 6 => "grace", 12 => "refund", 13 => "expire", _ => "unknown",
    };

    private static string Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static long Ms(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.TryGetInt64(out var l) ? l : 0;

    private static DateTime? Epoch(long ms) => ms > 0 ? DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime : null;

    private static string? Bearer(string? header) =>
        header is not null && header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? header["Bearer ".Length..].Trim() : null;
}
