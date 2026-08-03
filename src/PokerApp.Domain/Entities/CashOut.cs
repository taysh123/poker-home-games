namespace PokerApp.Domain.Entities;

public class CashOut : BaseEntity
{
    public Guid SessionId { get; private set; }
    public Session Session { get; private set; } = null!;
    public Guid? UserId { get; private set; }
    public User? User { get; private set; }
    public Guid? SessionPlayerId { get; private set; }
    public SessionPlayer? SessionPlayer { get; private set; }
    public decimal Amount { get; private set; }
    public DateTime Timestamp { get; private set; }

    private CashOut() { }

    public static CashOut Create(Guid sessionId, Guid sessionPlayerId, decimal amount)
        => new()
        {
            SessionId = sessionId,
            SessionPlayerId = sessionPlayerId,
            Amount = amount,
            Timestamp = DateTime.UtcNow
        };

    /// <summary>
    /// Clears the direct user link on account deletion, keeping the AMOUNT and the SessionPlayer
    /// link intact so the session still balances. See <see cref="BuyIn.AnonymizeUser"/> — same
    /// legacy-column reasoning applies.
    /// </summary>
    public void AnonymizeUser() => UserId = null;

    /// <summary>
    /// Re-keys a LEGACY row to its seat before the user link is severed.
    /// See <see cref="BuyIn.AttributeToSeat"/> — same orphaned-money reasoning applies.
    /// </summary>
    public void AttributeToSeat(Guid sessionPlayerId) => SessionPlayerId = sessionPlayerId;
}
