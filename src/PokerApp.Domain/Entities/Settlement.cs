using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class Settlement : BaseEntity
{
    public Guid SessionId { get; private set; }
    public Session Session { get; private set; } = null!;
    public Guid PayerUserId { get; private set; }
    public User PayerUser { get; private set; } = null!;
    public Guid ReceiverUserId { get; private set; }
    public User ReceiverUser { get; private set; } = null!;
    public decimal Amount { get; private set; }
    public SettlementStatus Status { get; private set; }

    private Settlement() { }
}
