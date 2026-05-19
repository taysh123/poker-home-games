using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class Debt : BaseEntity
{
    public Guid GroupId { get; private set; }
    public Group Group { get; private set; } = null!;
    public Guid FromUserId { get; private set; }
    public User FromUser { get; private set; } = null!;
    public Guid ToUserId { get; private set; }
    public User ToUser { get; private set; } = null!;
    public decimal Amount { get; private set; }
    public string? Reason { get; private set; }
    public SettlementStatus Status { get; private set; }
    public Guid CreatedByUserId { get; private set; }

    private Debt() { }

    public static Debt Create(Guid groupId, Guid fromUserId, Guid toUserId, decimal amount, string? reason, Guid createdByUserId)
        => new()
        {
            GroupId = groupId,
            FromUserId = fromUserId,
            ToUserId = toUserId,
            Amount = amount,
            Reason = reason?.Trim(),
            Status = SettlementStatus.Pending,
            CreatedByUserId = createdByUserId,
        };

    public void MarkAsPaid()
    {
        Status = SettlementStatus.Confirmed;
        SetUpdatedAt();
    }

    public void Cancel()
    {
        Status = SettlementStatus.Cancelled;
        SetUpdatedAt();
    }
}
