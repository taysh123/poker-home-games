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
}
