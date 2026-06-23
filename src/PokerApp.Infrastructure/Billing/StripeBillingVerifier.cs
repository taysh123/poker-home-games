using System.Net.Http.Headers;
using System.Text.Json;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Validates a Stripe Checkout session id → <see cref="VerifiedSubscription"/> by retrieving the session (with
/// its subscription expanded) from the Stripe API using the SECRET key. No SDK (raw HTTP). FAIL-CLOSED: wrong
/// store, not configured, API error, not paid, or missing subscription ⇒ null. NOTE: confirm the exact Stripe
/// JSON field mapping against the live API once an account exists.
/// </summary>
public sealed class StripeBillingVerifier(StripeSettings settings, BillingSettings billing, HttpClient httpClient) : IBillingVerifier
{
    public async Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
    {
        if (store != SubscriptionStore.Stripe || !settings.IsConfigured || string.IsNullOrWhiteSpace(token))
            return null;
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get,
                $"{settings.ApiBase.TrimEnd('/')}/v1/checkout/sessions/{Uri.EscapeDataString(token)}?expand[]=subscription");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.SecretKey);
            using var res = await httpClient.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return null;

            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var root = doc.RootElement;

            var paid = Str(root, "payment_status") == "paid" || Str(root, "status") == "complete";
            if (!paid) return null;
            if (!root.TryGetProperty("subscription", out var sub) || sub.ValueKind != JsonValueKind.Object) return null;

            var subId = Str(sub, "id");
            if (string.IsNullOrEmpty(subId)) return null;

            var isSandbox = root.TryGetProperty("livemode", out var lm) && lm.ValueKind == JsonValueKind.False;
            if (isSandbox && !billing.AcceptSandbox) return null; // test-mode cannot grant production

            var start = Epoch(PeriodField(sub, "current_period_start")) ?? DateTime.UtcNow;
            var end = Epoch(PeriodField(sub, "current_period_end")) ?? start.AddMonths(1);
            var autoRenew = !(sub.TryGetProperty("cancel_at_period_end", out var c) && c.ValueKind == JsonValueKind.True);

            return new VerifiedSubscription(
                SubscriptionStore.Stripe, FirstPriceId(sub), subId, start, end,
                AutoRenew: autoRenew, IsSandbox: isSandbox, Status: MapStatus(Str(sub, "status")));
        }
        catch { return null; }
    }

    private static SubscriptionStatus MapStatus(string s) => s switch
    {
        "active" or "trialing" => SubscriptionStatus.Active,
        "past_due" or "unpaid" => SubscriptionStatus.Grace,
        "canceled" => SubscriptionStatus.Canceled,
        _ => SubscriptionStatus.Expired,
    };

    private static string FirstPriceId(JsonElement sub) =>
        sub.TryGetProperty("items", out var items) && items.TryGetProperty("data", out var data)
        && data.ValueKind == JsonValueKind.Array && data.GetArrayLength() > 0
        && data[0].TryGetProperty("price", out var price) ? Str(price, "id") : "";

    // Newer Stripe API moved the period fields onto the subscription item; read the sub level first, then items.data[0].
    private static long PeriodField(JsonElement sub, string field)
    {
        var v = Long(sub, field);
        if (v > 0) return v;
        if (sub.TryGetProperty("items", out var items) && items.TryGetProperty("data", out var data)
            && data.ValueKind == JsonValueKind.Array && data.GetArrayLength() > 0)
            return Long(data[0], field);
        return 0;
    }

    private static string Str(JsonElement e, string n) => e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
    private static long Long(JsonElement e, string n) => e.TryGetProperty(n, out var v) && v.TryGetInt64(out var l) ? l : 0;
    private static DateTime? Epoch(long s) => s > 0 ? DateTimeOffset.FromUnixTimeSeconds(s).UtcDateTime : null;
}
