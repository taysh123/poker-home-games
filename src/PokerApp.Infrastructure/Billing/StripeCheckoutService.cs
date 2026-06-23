using System.Net.Http.Headers;
using System.Text.Json;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Creates a Stripe Checkout session (subscription mode) via the Stripe API using the SECRET key. Success/cancel
/// URLs derive from <see cref="IWebSettings"/> (never hardcoded). FAIL-CLOSED: not configured, no price id, or
/// API error ⇒ null. No SDK (raw HTTP; Stripe expects application/x-www-form-urlencoded).
/// </summary>
public sealed class StripeCheckoutService(StripeSettings settings, IWebSettings web, HttpClient httpClient) : IStripeCheckoutService
{
    public async Task<string?> CreateSubscriptionCheckoutUrlAsync(Guid userId, string plan, CancellationToken ct = default)
    {
        if (!settings.IsConfigured) return null;
        var priceId = settings.PriceIdFor(plan);
        if (priceId is null) return null;

        var baseUrl = string.IsNullOrWhiteSpace(web.WebBaseUrl) ? string.Empty : web.WebBaseUrl.TrimEnd('/');
        var form = new Dictionary<string, string>
        {
            ["mode"] = "subscription",
            ["line_items[0][price]"] = priceId,
            ["line_items[0][quantity]"] = "1",
            ["client_reference_id"] = userId.ToString(),
            ["success_url"] = $"{baseUrl}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            ["cancel_url"] = $"{baseUrl}/billing/cancel",
        };

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"{settings.ApiBase.TrimEnd('/')}/v1/checkout/sessions")
            {
                Content = new FormUrlEncodedContent(form),
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.SecretKey);
            using var res = await httpClient.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return null;

            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            return doc.RootElement.TryGetProperty("url", out var u) && u.ValueKind == JsonValueKind.String ? u.GetString() : null;
        }
        catch { return null; }
    }
}
