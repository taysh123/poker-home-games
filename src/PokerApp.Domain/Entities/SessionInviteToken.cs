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
        SetUpdatedAt();
    }

    public void Revoke()
    {
        IsRevoked = true;
        SetUpdatedAt();
    }
}
