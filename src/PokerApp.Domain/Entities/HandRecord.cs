namespace PokerApp.Domain.Entities;

public class HandRecord : BaseEntity
{
    public Guid SessionId { get; private set; }
    public Session Session { get; private set; } = null!;
    public string WinnerName { get; private set; } = string.Empty;
    public decimal PotAmount { get; private set; }
    public string? Note { get; private set; }
    public Guid CreatedByUserId { get; private set; }

    private HandRecord() { }

    /// <summary>
    /// Severs the link to the account that logged this hand, when that account is deleted. The ROW
    /// SURVIVES — it is the table's record of a real hand, and the winner's name in it is the other
    /// players' memory of their game night, not the leaver's data (owner decision 2026-08-05).
    ///
    /// <see cref="CreatedByUserId"/> is a bare <c>Guid</c> with no navigation property and no
    /// configured relationship, so nothing cascades and the FK-inventory ratchet could not see it —
    /// which is how the raw account id survived deletion forever while being served over the API
    /// (audit 2026-08-03, HIGH #4). <c>Guid.Empty</c> rather than null because the column is
    /// non-nullable; making it nullable would need a migration for no behavioural gain, and the
    /// only consumer (DeleteHandRecord's "you can only delete hands you logged") correctly refuses
    /// everyone once the value can match no live account.
    /// </summary>
    public void AnonymizeCreator() => CreatedByUserId = Guid.Empty;

    public static HandRecord Create(Guid sessionId, string winnerName, decimal potAmount, string? note, Guid createdByUserId)
        => new()
        {
            SessionId = sessionId,
            WinnerName = winnerName.Trim(),
            PotAmount = potAmount,
            Note = note?.Trim(),
            CreatedByUserId = createdByUserId,
        };
}
