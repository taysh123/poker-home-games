namespace PokerApp.Domain.Entities;

public class SessionPlayer : BaseEntity
{
    public Guid SessionId { get; private set; }
    public Session Session { get; private set; } = null!;
    public Guid? UserId { get; private set; }
    public User? User { get; private set; }
    public string? GuestName { get; private set; }
    public Guid? LinkedUserId { get; private set; }
    public User? LinkedUser { get; private set; }

    public bool IsGuest => GuestName is not null;
    public string DisplayName => GuestName ?? User?.Username ?? "Unknown";
    public Guid? SettlementUserId => LinkedUserId ?? UserId;

    private SessionPlayer() { }

    public static SessionPlayer CreateForUser(Guid sessionId, Guid userId)
        => new() { SessionId = sessionId, UserId = userId };

    public static SessionPlayer CreateForGuest(Guid sessionId, string guestName, Guid? linkedUserId = null)
        => new() { SessionId = sessionId, GuestName = guestName, LinkedUserId = linkedUserId };

    public void AnonymizeUser() => UserId = null;

    /// <summary>
    /// Clears the guest→account link when the linked account is deleted. The PLAYER ROW SURVIVES:
    /// a guest row represents a real person who sat at a real table, so dropping it would shrink
    /// the session's participant list and stop the other players' totals reconciling.
    /// </summary>
    public void UnlinkUser() => LinkedUserId = null;
}
