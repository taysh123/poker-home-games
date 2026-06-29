using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Creates a Paddle Billing checkout by POSTing a transaction to the Paddle REST API (the current API — NOT
/// Paddle Classic) with the server API key. FAIL-CLOSED: not configured, no price id for the plan, API error, or
/// a response missing the checkout url ⇒ null. No SDK (raw HTTP; there is no official Paddle .NET SDK). Paddle's
/// REST API takes/returns application/json.
///
/// Request : POST {ApiBaseUrl}/transactions   (Authorization: Bearer {ApiKey})
///   { "items":[{ "price_id":"&lt;pri_…&gt;", "quantity":1 }], "custom_data":{ "app_user_id":"&lt;guid&gt;" },
///     "collection_mode":"automatic" }
/// Response: { "data": { "id":"txn_…", "checkout": { "url":"https://…/?_ptxn=txn_…" } } }
///
/// PADDLE-VERIFY (sandbox): the field names/nesting below are from the research doc, not a captured sandbox call.
/// Confirm against a real sandbox POST /transactions before this is load-bearing. See docs/release/paddle-billing-research.md.
/// </summary>
public sealed class PaddleCheckoutService(PaddleSettings settings, HttpClient httpClient) : IPaddleCheckoutService
{
    /// <summary>Active-provider entry point (ICheckoutService): returns just the checkout URL, or null (fail-closed).</summary>
    public async Task<string?> CreateSubscriptionCheckoutUrlAsync(Guid userId, string plan, CancellationToken ct = default)
        => (await CreateSubscriptionCheckoutAsync(userId, plan, ct))?.Url;

    public async Task<PaddleCheckout?> CreateSubscriptionCheckoutAsync(Guid userId, string plan, CancellationToken ct = default)
    {
        if (!settings.IsConfigured) return null;
        var priceId = settings.PriceIdFor(plan);
        if (priceId is null) return null;

        // PADDLE-VERIFY (sandbox): request body — items[].price_id is snake_case in the REST API (priceId in
        // Paddle.js); custom_data.app_user_id is read back at data.custom_data on every subscription/transaction
        // webhook; collection_mode "automatic" should auto-populate checkout.url (+ ?_ptxn=). Confirm all three.
        var payload = new
        {
            items = new[] { new { price_id = priceId, quantity = 1 } },
            custom_data = new { app_user_id = userId.ToString() },
            collection_mode = "automatic",
        };

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"{settings.ApiBaseUrl.TrimEnd('/')}/transactions")
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiKey);

            using var res = await httpClient.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return null;

            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));

            // PADDLE-VERIFY (sandbox): response nesting — data.checkout.url + data.id (txn_…). Parsing is
            // null-safe; any missing field yields null rather than throwing (never fabricate a checkout).
            if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
                return null;

            var checkout = data.TryGetProperty("checkout", out var co) && co.ValueKind == JsonValueKind.Object ? co : default;
            var url = Str(checkout, "url");
            var txnId = Str(data, "id");
            return string.IsNullOrEmpty(url) ? null : new PaddleCheckout(url, txnId);
        }
        catch { return null; }
    }

    private static string Str(JsonElement e, string n) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? "" : "";
}
