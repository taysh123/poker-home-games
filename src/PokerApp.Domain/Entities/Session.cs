using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class Session : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public Guid GroupId { get; private set; }
    public Group Group { get; private set; } = null!;
    public decimal SmallBlind { get; private set; }
    public decimal BigBlind { get; private set; }
    public SessionStatus Status { get; private set; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? EndedAt { get; private set; }

    private readonly List<BuyIn> _buyIns = [];
    public IReadOnlyCollection<BuyIn> BuyIns => _buyIns.AsReadOnly();

    private readonly List<CashOut> _cashOuts = [];
    public IReadOnlyCollection<CashOut> CashOuts => _cashOuts.AsReadOnly();

    private readonly List<Settlement> _settlements = [];
    public IReadOnlyCollection<Settlement> Settlements => _settlements.AsReadOnly();

    private Session() { }
}
