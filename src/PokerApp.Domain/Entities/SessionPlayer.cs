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
    public DateTime? AccountDeletedAt { get; private set; }

    public bool IsGuest => GuestName is not null;
    public string DisplayName => GuestName ?? User?.Username ?? "Unknown";
    public Guid? SettlementUserId => LinkedUserId ?? UserId;

    private SessionPlayer() { }

    public static SessionPlayer CreateForUser(Guid sessionId, Guid userId)
        => new() { SessionId = sessionId, UserId = userId };

    public static SessionPlayer CreateForGuest(Guid sessionId, string guestName, Guid? linkedUserId = null)
        => new() { SessionId = sessionId, GuestName = guestName, LinkedUserId = linkedUserId };

    /// <summary>
    /// Severs the identity link when this player's own account is deleted, and stamps
    /// <see cref="AccountDeletedAt"/> so downstream code can tell "an account was deleted here"
    /// without inferring it from the row's shape.
    /// </summary>
    public void AnonymizeUser()
    {
        UserId = null;
        AccountDeletedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Clears the guest→account link when the linked account is deleted. The PLAYER ROW SURVIVES:
    /// a guest row represents a real person who sat at a real table, so dropping it would shrink
    /// the session's participant list and stop the other players' totals reconciling.
    ///
    /// GuestName also survives, which makes the unlinked row indistinguishable by SHAPE from an
    /// ordinary walk-in guest — so <see cref="AccountDeletedAt"/> is stamped here as the ONLY
    /// durable record that a deleted account once stood behind this seat. CalculateSettlements
    /// keys its refuse-to-recalculate guard on that marker; without it the linked-guest shape
    /// slid past the guard and the survivors' settlements were destroyed (fleet finding,
    /// 2026-08-03).
    /// </summary>
    public void UnlinkUser()
    {
        LinkedUserId = null;
        AccountDeletedAt = DateTime.UtcNow;
    }
}
