namespace PokerApp.Domain.Entities;

public class BuyIn : BaseEntity
{
    public Guid SessionId { get; private set; }
    public Session Session { get; private set; } = null!;
    public Guid? UserId { get; private set; }
    public User? User { get; private set; }
    public Guid? SessionPlayerId { get; private set; }
    public SessionPlayer? SessionPlayer { get; private set; }
    public decimal Amount { get; private set; }
    public DateTime Timestamp { get; private set; }

    private BuyIn() { }

    public static BuyIn Create(Guid sessionId, Guid sessionPlayerId, decimal amount)
        => new()
        {
            SessionId = sessionId,
            SessionPlayerId = sessionPlayerId,
            Amount = amount,
            Timestamp = DateTime.UtcNow
        };

    /// <summary>
    /// Clears the direct user link on account deletion, keeping the AMOUNT and the SessionPlayer
    /// link intact so the session still balances. Current rows are created without a UserId, but
    /// legacy rows written before SessionPlayerId existed still carry one — and that column is a
    /// RESTRICT foreign key, so it blocks the delete regardless of how the row was created.
    /// </summary>
    public void AnonymizeUser() => UserId = null;

    /// <summary>
    /// Re-keys a LEGACY row (attributed only by UserId) to its seat before the user link is
    /// severed. Without this, AnonymizeUser orphans the amount from every balance projection and
    /// the departed player's cash line comes out money-wrong (fleet-demonstrated sign inversion).
    /// </summary>
    public void AttributeToSeat(Guid sessionPlayerId) => SessionPlayerId = sessionPlayerId;
}
