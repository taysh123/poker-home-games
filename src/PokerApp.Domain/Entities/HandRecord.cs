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
