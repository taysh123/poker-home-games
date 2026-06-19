using System.Text.Json;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Billing;

/// <summary>Validates an Apple StoreKit2 signed transaction (JWS) → VerifiedSubscription. Fail-closed.</summary>
public sealed class AppleBillingVerifier(AppleJwsVerifier appleJws, BillingSettings billing) : IBillingVerifier
{
    public Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
    {
        if (store != SubscriptionStore.Apple) return Task.FromResult<VerifiedSubscription?>(null);
        var json = appleJws.VerifyAndExtractPayload(token, DateTime.UtcNow);
        if (json is null) return Task.FromResult<VerifiedSubscription?>(null);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var r = doc.RootElement;
            var environment = Str(r, "environment");
            var isSandbox = string.Equals(environment, "Sandbox", StringComparison.OrdinalIgnoreCase);
            if (isSandbox && !billing.AcceptSandbox) return Task.FromResult<VerifiedSubscription?>(null);

            var originalTransactionId = Str(r, "originalTransactionId");
            var productId = Str(r, "productId");
            var start = Epoch(Ms(r, "purchaseDate")) ?? DateTime.UtcNow;
            var end = Epoch(Ms(r, "expiresDate")) ?? start.AddMonths(1);
            if (string.IsNullOrEmpty(originalTransactionId) || string.IsNullOrEmpty(productId))
                return Task.FromResult<VerifiedSubscription?>(null);

            return Task.FromResult<VerifiedSubscription?>(new VerifiedSubscription(
                SubscriptionStore.Apple, productId, originalTransactionId, start, end,
                AutoRenew: true, IsSandbox: isSandbox, Status: SubscriptionStatus.Active));
        }
        catch { return Task.FromResult<VerifiedSubscription?>(null); }
    }

    private static string Str(JsonElement e, string n) => e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
    private static long Ms(JsonElement e, string n) => e.TryGetProperty(n, out var v) && v.TryGetInt64(out var l) ? l : 0;
    private static DateTime? Epoch(long ms) => ms > 0 ? DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime : null;
}
