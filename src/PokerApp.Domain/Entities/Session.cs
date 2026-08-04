using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class Session : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public Guid? GroupId { get; private set; }
    public Group? Group { get; private set; }
    public Guid CreatorId { get; private set; }
    public decimal? ChipRatio { get; private set; }
    public decimal? DefaultBuyIn { get; private set; }
    public SessionStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? EndedAt { get; private set; }

    /// <summary>
    /// Optimistic concurrency token guarding the ONE transition that writes money: <see cref="End"/>
    /// (audit 2026-08-03, HIGH #3). EF puts the value read by THIS request into the UPDATE's WHERE
    /// clause, so a second writer that read the same value matches zero rows and gets a
    /// <c>DbUpdateConcurrencyException</c> instead of silently committing a second full set of
    /// cash-outs on top of the first.
    ///
    /// ONLY <see cref="End"/> bumps it, and that is load-bearing rather than an omission.
    /// <see cref="Start"/> deliberately does NOT: <c>AddBuyInCommandHandler</c> auto-starts a Draft
    /// session as a side effect of the first buy-in, so bumping there made two concurrent FIRST
    /// buy-ins race — the loser's buy-in row rolled back with the rejected UPDATE and a real money
    /// row was silently dropped (proven against PostgreSQL by the T0.2 review fleet; pinned by
    /// Two_concurrent_first_buyins_on_a_draft_session_both_record). Nothing about starting a session
    /// needs serialising: both racers want the same end state (Active) and neither decision depends
    /// on winning. Ending does — it is gated on a status check and writes CashOut rows behind it.
    /// Cosmetic edits (<see cref="UpdateName"/>, <see cref="UpdateNotes"/>) likewise do not bump it.
    /// Every one of those writers is still CHECKED against the token (EF adds a concurrency token to
    /// the WHERE clause of every UPDATE of this row), so they lose to a concurrent end — they just
    /// cannot cause a conflict for each other.
    ///
    /// Managed here in the domain, not by the provider, and the two provider-native options were
    /// rejected for DIFFERENT reasons (both verified by execution, not assumed):
    /// <c>IsRowVersion()</c> marks the property store-generated, which self-updates only where the
    /// store actually generates it (SQL Server). On PostgreSQL it is genuinely INERT — with the
    /// shipped <c>DEFAULT 0</c> column the token stays 0, the check compares 0 to 0, and both racers
    /// commit: a guard that cannot fail, which reads as coverage while protecting nothing. On SQLite
    /// it does not sit at 0, it fails loudly — EF omits a store-generated property from the INSERT
    /// and every seed hits <c>NOT NULL constraint failed: Sessions.Version</c>.
    /// Npgsql's <c>xmin</c> (<c>UseXminAsConcurrencyToken()</c>) would actually WORK in production —
    /// it is a real rowversion — but it is a PostgreSQL system column SQLite does not have, so the
    /// suite could never exercise the guard at all, and it is <c>[Obsolete]</c> in Npgsql 8.
    /// Incrementing in the domain behaves identically on both providers, which is precisely why the
    /// race is provable in EndSessionConcurrencyTests instead of merely simulated.
    /// </summary>
    public int Version { get; private set; }

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
        string name, Guid creatorId, Guid? groupId = null,
        decimal? chipRatio = null, decimal? defaultBuyIn = null)
        => new()
        {
            Name = name,
            CreatorId = creatorId,
            GroupId = groupId,
            ChipRatio = chipRatio,
            DefaultBuyIn = defaultBuyIn,
            Status = SessionStatus.Draft
        };

    public void Start()
    {
        Status = SessionStatus.Active;
        StartedAt = DateTime.UtcNow;
        // No Version bump — see the Version doc. AddBuyIn auto-starts a Draft session, so bumping
        // here makes two concurrent first buy-ins race and silently drops the loser's money row.
        SetUpdatedAt();
    }

    public void End()
    {
        Status = SessionStatus.Finished;
        EndedAt = DateTime.UtcNow;
        Version++;   // the money-writing transition — see the Version doc
        SetUpdatedAt();
    }

    public void UpdateName(string name)
    {
        Name = name.Trim();
        SetUpdatedAt();
    }

    public void UpdateNotes(string? notes)
    {
        Notes = notes?.Trim();
        SetUpdatedAt();
    }
}
