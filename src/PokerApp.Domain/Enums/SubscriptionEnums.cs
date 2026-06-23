namespace PokerApp.Domain.Enums;

public enum SubscriptionStore
{
    Apple = 0,
    Google = 1,
    Stripe = 2,      // web billing
    RevenueCat = 3,  // mobile aggregator (iOS + Android)
}

/// <summary>
/// Lifecycle of a subscription. Entitlement is "premium-active" for Active/Grace/Canceled
/// while the current period has not ended; Refunded/Expired revoke access.
/// </summary>
public enum SubscriptionStatus
{
    Active = 0,
    Grace = 1,     // billing retry; access retained until grace deadline
    Canceled = 2,  // auto-renew off; access retained until period end
    Expired = 3,
    Refunded = 4,  // revoke immediately
}

/// <summary>Append-only credit ledger entry kinds (audit + reconstruction).</summary>
public enum CreditEntryType
{
    GrantOnboarding = 0,        // free lifetime taste
    GrantSubscriptionPeriod = 1,// premium monthly quota
    GrantTopUp = 2,             // future consumable bundles
    Consume = 3,
    Refund = 4,                 // compensating (e.g. AI provider failure)
    Revoke = 5,                 // admin / refund clawback
}
