namespace PokerApp.Domain.Entities;

public class BuyIn : BaseEntity
{
    public Guid SessionId { get; private set; }
    public Session Session { get; private set; } = null!;
    public Guid UserId { get; private set; }
    public User User { get; private set; } = null!;
    public decimal Amount { get; private set; }
    public DateTime Timestamp { get; private set; }

    private BuyIn() { }
}
