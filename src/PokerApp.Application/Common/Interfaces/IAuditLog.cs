namespace PokerApp.Application.Common.Interfaces;

/// <summary>Auditable, alert-ready event categories for the monetization + fraud surfaces.</summary>
public enum AuditCategory
{
    CreditSpend,
    CreditTopUp,
    AiUsage,
    AiCost,                 // cost-tracking hook for future paid AI providers
    SubscriptionLifecycle,
    WebhookProcessing,
    Fraud,
}

/// <summary>
/// Structured audit/observability sink. Implementations write alert-ready structured logs (and can
/// later fan out to a metrics/SIEM pipeline). Must never throw into the calling command.
/// </summary>
public interface IAuditLog
{
    void Record(AuditCategory category, string action, Guid? userId = null, object? data = null);
}
