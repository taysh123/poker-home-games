using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Validates a RevenueCat app_user_id → <see cref="VerifiedSubscription"/> by fetching the subscriber from the
/// RevenueCat REST API with the SECRET key and reading the active entitlement (furthest-future, unexpired). No
/// SDK (raw HTTP). FAIL-CLOSED: wrong store, not configured, API error, or no active entitlement ⇒ null. NOTE:
/// confirm the exact field mapping against the live RevenueCat API once an account exists.
/// </summary>
public sealed class RevenueCatBillingVerifier(RevenueCatSettings settings, BillingSettings billing, HttpClient httpClient) : IBillingVerifier
{
    public async Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
    {
        if (store != SubscriptionStore.RevenueCat || !settings.IsConfigured || string.IsNullOrWhiteSpace(token))
            return null;
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get,
                $"{settings.ApiBase.TrimEnd('/')}/v1/subscribers/{Uri.EscapeDataString(token)}");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.SecretApiKey);
            using var res = await httpClient.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return null;

            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            if (!doc.RootElement.TryGetProperty("subscriber", out var subscriber)) return null;
            if (!subscriber.TryGetProperty("entitlements", out var ents) || ents.ValueKind != JsonValueKind.Object) return null;

            // Pick the active entitlement with the furthest-future expiry.
            var now = DateTime.UtcNow;
            string productId = ""; DateTime end = default; var found = false;
            foreach (var ent in ents.EnumerateObject())
            {
                var expires = Iso(ent.Value, "expires_date");
                if (expires is null || expires <= now) continue;
                if (!found || expires > end) { end = expires.Value; productId = Str(ent.Value, "product_identifier"); found = true; }
            }
            if (!found) return null;

            // Period start + sandbox flag from the matching subscription entry, if present.
            var start = now;
            var isSandbox = false;
            if (subscriber.TryGetProperty("subscriptions", out var subs) && subs.ValueKind == JsonValueKind.Object
                && !string.IsNullOrEmpty(productId) && subs.TryGetProperty(productId, out var s))
            {
                start = Iso(s, "purchase_date") ?? now;
                isSandbox = s.TryGetProperty("is_sandbox", out var sb) && sb.ValueKind == JsonValueKind.True;
            }
            if (isSandbox && !billing.AcceptSandbox) return null;

            return new VerifiedSubscription(
                SubscriptionStore.RevenueCat, productId, token, start, end,
                AutoRenew: true, IsSandbox: isSandbox, Status: SubscriptionStatus.Active);
        }
        catch { return null; }
    }

    private static string Str(JsonElement e, string n) => e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static DateTime? Iso(JsonElement e, string n) =>
        e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String
        && DateTime.TryParse(v.GetString(), CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var d) ? d : null;
}
