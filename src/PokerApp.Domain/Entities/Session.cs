using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class Session : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public Guid GroupId { get; private set; }
    public Group Group { get; private set; } = null!;
    public decimal SmallBlind { get; private set; }
    public decimal BigBlind { get; private set; }
    public decimal? ChipRatio { get; private set; }
    public decimal? DefaultBuyIn { get; private set; }
    public SessionStatus Status { get; private set; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? EndedAt { get; private set; }

    private readonly List<BuyIn> _buyIns = [];
    public IReadOnlyCollection<BuyIn> BuyIns => _buyIns.AsReadOnly();

    private readonly List<CashOut> _cashOuts = [];
    public IReadOnlyCollection<CashOut> CashOuts => _cashOuts.AsReadOnly();

    private readonly List<Settlement> _settlements = [];
    public IReadOnlyCollection<Settlement> Settlements => _settlements.AsReadOnly();

    private readonly List<SessionPlayer> _sessionPlayers = [];
    public IReadOnlyCollection<SessionPlayer> SessionPlayers => _sessionPlayers.AsReadOnly();

    private Session() { }

    public static Session Create(
        string name, Guid groupId, decimal smallBlind, decimal bigBlind,
        decimal? chipRatio = null, decimal? defaultBuyIn = null)
        => new()
        {
            Name = name,
            GroupId = groupId,
            SmallBlind = smallBlind,
            BigBlind = bigBlind,
            ChipRatio = chipRatio,
            DefaultBuyIn = defaultBuyIn,
            Status = SessionStatus.Draft
        };

    public void Start()
    {
        Status = SessionStatus.Active;
        StartedAt = DateTime.UtcNow;
        SetUpdatedAt();
    }

    public void End()
    {
        Status = SessionStatus.Finished;
        EndedAt = DateTime.UtcNow;
        SetUpdatedAt();
    }
}
