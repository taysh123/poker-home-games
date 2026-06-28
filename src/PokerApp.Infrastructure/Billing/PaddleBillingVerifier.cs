using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Validates a Paddle transaction id (<c>txn_…</c> — the success-redirect carries it as <c>?_ptxn=</c>) →
/// <see cref="VerifiedSubscription"/> by retrieving the transaction (and, when the period isn't on the transaction,
/// its subscription) from the Paddle REST API with the server API key. No SDK (raw HTTP; there is no official .NET
/// Paddle SDK). FAIL-CLOSED: wrong store, not configured, API error, not completed/paid, or no <c>subscription_id</c>
/// (a one-time / non-subscription transaction) ⇒ null. This is the redirect "instant unlock" path; the webhook
/// stays the source of truth, and both upsert the SAME Subscription (keyed by Store + subscription id).
///
/// PADDLE-VERIFY (sandbox): GET {ApiBaseUrl}/transactions/{id} is assumed to return
///   { "data": { "id":"txn_…", "status":"completed", "subscription_id":"sub_…",
///               "items":[{ "price":{ "id":"pri_…" } }], "billing_period":{ "starts_at","ends_at" } }, "meta": … }
/// and GET {ApiBaseUrl}/subscriptions/{id} → { "data": { "status":…, "current_billing_period":{ "starts_at","ends_at" },
///   "items":[{ "price":{ "id":"pri_…" } }] } }. Confirm the exact field names/nesting (esp. transaction-level
/// billing_period vs reading the period off the subscription) against a real sandbox response before this is
/// load-bearing. See docs/release/paddle-billing-research.md §5/§6.
/// </summary>
public sealed class PaddleBillingVerifier(PaddleSettings settings, BillingSettings billing, HttpClient httpClient) : IBillingVerifier
{
    public async Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
    {
        if (store != SubscriptionStore.Paddle || !settings.IsConfigured || string.IsNullOrWhiteSpace(token))
            return null;
        try
        {
            var txnJson = await GetAsync($"transactions/{Uri.EscapeDataString(token)}", ct);
            if (txnJson is null) return null;

            using var txnDoc = JsonDocument.Parse(txnJson);
            if (!txnDoc.RootElement.TryGetProperty("data", out var t) || t.ValueKind != JsonValueKind.Object) return null;

            // Only a completed/paid transaction grants. PADDLE-VERIFY: full status enum (created/paid/completed/
            // billed/…) — we accept the "money received" states.
            var status = Str(t, "status");
            if (status is not ("completed" or "paid" or "billed")) return null;

            // A subscription transaction carries the created subscription id; a one-time purchase does not → nothing to grant.
            var subId = Str(t, "subscription_id");
            if (string.IsNullOrEmpty(subId)) return null;

            // Paddle doesn't return a livemode flag on the transaction; infer sandbox from the API host. Sandbox
            // cannot grant production unless explicitly allowed (fail-closed separation, mirrors the Stripe verifier).
            var isSandbox = settings.ApiBaseUrl.Contains("sandbox", StringComparison.OrdinalIgnoreCase);
            if (isSandbox && !billing.AcceptSandbox) return null;

            DateTime? start = ParseRfc3339(BillingPeriod(t, "starts_at"));
            DateTime? end = ParseRfc3339(BillingPeriod(t, "ends_at"));
            var productId = FirstPriceId(t);
            var mappedStatus = SubscriptionStatus.Active; // a paid txn ⇒ active by default

            // The authoritative period + status live on the subscription — fetch it when the transaction didn't carry them.
            if (start is null || end is null || string.IsNullOrEmpty(productId))
            {
                var subJson = await GetAsync($"subscriptions/{Uri.EscapeDataString(subId)}", ct);
                if (subJson is not null)
                {
                    using var subDoc = JsonDocument.Parse(subJson);
                    if (subDoc.RootElement.TryGetProperty("data", out var s) && s.ValueKind == JsonValueKind.Object)
                    {
                        if (s.TryGetProperty("current_billing_period", out var cbp) && cbp.ValueKind == JsonValueKind.Object)
                        {
                            start ??= ParseRfc3339(Str(cbp, "starts_at"));
                            end ??= ParseRfc3339(Str(cbp, "ends_at"));
                        }
                        if (string.IsNullOrEmpty(productId)) productId = FirstPriceId(s);
                        mappedStatus = MapStatus(Str(s, "status"));
                    }
                }
            }

            var periodStart = start ?? DateTime.UtcNow;
            var periodEnd = end ?? periodStart.AddMonths(1);

            return new VerifiedSubscription(
                SubscriptionStore.Paddle, productId, subId, periodStart, periodEnd,
                AutoRenew: true, IsSandbox: isSandbox, Status: mappedStatus);
        }
        catch { return null; }
    }

    private async Task<string?> GetAsync(string path, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{settings.ApiBaseUrl.TrimEnd('/')}/{path}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiKey);
        using var res = await httpClient.SendAsync(req, ct);
        return res.IsSuccessStatusCode ? await res.Content.ReadAsStringAsync(ct) : null;
    }

    private static SubscriptionStatus MapStatus(string s) => s switch
    {
        "active" or "trialing" => SubscriptionStatus.Active,
        "past_due" or "paused" => SubscriptionStatus.Grace,
        "canceled" => SubscriptionStatus.Canceled,
        _ => SubscriptionStatus.Active, // a completed txn whose sub status is unknown: the payment landed ⇒ active
    };

    private static string FirstPriceId(JsonElement entity) =>
        entity.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array
        && items.GetArrayLength() > 0 && items[0].TryGetProperty("price", out var price)
            ? Str(price, "id") : "";

    private static string BillingPeriod(JsonElement entity, string field) =>
        entity.TryGetProperty("billing_period", out var bp) && bp.ValueKind == JsonValueKind.Object ? Str(bp, field) : "";

    private static DateTime? ParseRfc3339(string s) =>
        DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var dto) ? dto.UtcDateTime : null;

    private static string Str(JsonElement e, string n) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? "" : "";
}
