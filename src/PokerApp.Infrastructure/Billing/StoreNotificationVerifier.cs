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
    GooglePlaySettings google) : IStoreNotificationVerifier
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
