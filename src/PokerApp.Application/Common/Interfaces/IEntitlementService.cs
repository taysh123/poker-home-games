namespace PokerApp.Application.Common.Interfaces;

/// <summary>Server-computed entitlement (never derived from client state).</summary>
public sealed record EntitlementDto(string Plan, string Status, string? ProductId, DateTime? ExpiresAt)
{
    public bool IsPremium => Plan == "premium";
    public static EntitlementDto Free => new("free", "none", null, null);
}

public interface IEntitlementService
{
    /// <summary>Current entitlement for a user, computed from the newest valid subscription.</summary>
    Task<EntitlementDto> GetAsync(Guid userId, CancellationToken ct = default);
}
