using System;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Common;

/// <summary>
/// Single source for the store-string ↔ <see cref="SubscriptionStore"/> mapping (apple|google|stripe|revenuecat).
/// Used by the billing validators + handlers so adding a store is one edit here, not a scatter of ternaries.
/// </summary>
public static class SubscriptionStoreParser
{
    public static bool TryParse(string? store, out SubscriptionStore result)
    {
        switch (store?.Trim().ToLowerInvariant())
        {
            case "apple": result = SubscriptionStore.Apple; return true;
            case "google": result = SubscriptionStore.Google; return true;
            case "stripe": result = SubscriptionStore.Stripe; return true;
            case "revenuecat": result = SubscriptionStore.RevenueCat; return true;
            default: result = default; return false;
        }
    }

    public static bool IsValid(string? store) => TryParse(store, out _);

    public static SubscriptionStore Parse(string? store) =>
        TryParse(store, out var s) ? s : throw new ArgumentException($"Unknown store '{store}'.", nameof(store));
}
