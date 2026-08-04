namespace PokerApp.Domain.Entities;

public class SessionInviteToken : BaseEntity
{
    public Guid SessionId { get; private set; }
    public Session Session { get; private set; } = null!;
    public Guid CreatedByUserId { get; private set; }
    public string Token { get; private set; } = string.Empty;
    public DateTime ExpiresAt { get; private set; }
    public bool IsRevoked { get; private set; }
    public Guid? UsedByUserId { get; private set; }
    public DateTime? UsedAt { get; private set; }

    /// <summary>
    /// Optimistic concurrency token making redemption atomic (audit 2026-08-03, MEDIUM — named
    /// there as the same TOCTOU class as EndSession's HIGH #3). "Single-use" is only as strong as
    /// the gap between reading <see cref="IsActive"/> and writing <see cref="UsedAt"/>: two
    /// redemptions in flight at once both read <c>UsedAt IS NULL</c> and both consume the token.
    /// The unique index on the token string does not help — it stops a duplicate TOKEN, not a
    /// duplicate USE. Same mechanism as <see cref="Session.Version"/>, on the row this handler
    /// actually mutates; see that member for why it is application-managed rather than a provider
    /// rowversion.
    /// </summary>
    public int Version { get; private set; }

    private SessionInviteToken() { }

    public static SessionInviteToken Create(Guid sessionId, Guid createdByUserId)
        => new()
        {
            SessionId = sessionId,
            CreatedByUserId = createdByUserId,
            Token = Guid.NewGuid().ToString("N"),
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            IsRevoked = false,
        };

    public bool IsActive => !IsRevoked && !UsedAt.HasValue && ExpiresAt > DateTime.UtcNow;

    public void Use(Guid userId)
    {
        UsedByUserId = userId;
        UsedAt = DateTime.UtcNow;
        Consume();
    }

    public void Revoke()
    {
        IsRevoked = true;
        Consume();
    }

    /// <summary>Marks a use-or-revoke transition: advances the concurrency token and the timestamp.</summary>
    private void Consume()
    {
        Version++;
        SetUpdatedAt();
    }
}
