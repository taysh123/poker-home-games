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
    /// Optimistic concurrency token guarding this session's STATE TRANSITIONS, bumped by
    /// <see cref="Start"/> and <see cref="End"/> (audit 2026-08-03, HIGH #3). EF puts the value
    /// read by THIS request into the UPDATE's WHERE clause, so a second writer that read the same
    /// value matches zero rows and gets a <c>DbUpdateConcurrencyException</c> instead of silently
    /// committing on top of the first.
    ///
    /// Managed here in the domain, NOT via EF's <c>IsRowVersion()</c> or Npgsql's <c>xmin</c>.
    /// <c>IsRowVersion()</c> marks the property store-generated, which self-updates only on a
    /// provider that actually generates it (SQL Server). On PostgreSQL (production) and SQLite
    /// (tests) nothing would ever change it: the token would sit at 0 forever and every check
    /// would compare 0 to 0 and pass — a guard that cannot fail, which reads as coverage while
    /// protecting nothing. <c>xmin</c> is a PostgreSQL system column SQLite does not have, so it
    /// could not be exercised by a test either. Incrementing it in the domain behaves identically
    /// on both providers, which is precisely why the race is provable in EndSessionConcurrencyTests.
    ///
    /// Cosmetic edits (<see cref="UpdateName"/>, <see cref="UpdateNotes"/>) deliberately do NOT
    /// bump it — renaming a session concurrently with anything else is harmless, and bumping there
    /// would only manufacture conflicts. They are still CHECKED against it (EF adds every
    /// concurrency token to the WHERE clause), so a rename racing a genuine transition is refused.
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
        Transition();
    }

    public void End()
    {
        Status = SessionStatus.Finished;
        EndedAt = DateTime.UtcNow;
        Transition();
    }

    /// <summary>Marks a state transition: advances the concurrency token and the timestamp.</summary>
    private void Transition()
    {
        Version++;
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
