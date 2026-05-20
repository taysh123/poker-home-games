namespace PokerApp.Domain.Entities;

public class GroupInviteLink : BaseEntity
{
    public Guid GroupId { get; private set; }
    public Group Group { get; private set; } = null!;
    public Guid CreatedByUserId { get; private set; }
    public string Token { get; private set; } = string.Empty;
    public DateTime ExpiresAt { get; private set; }
    public bool IsRevoked { get; private set; }

    private GroupInviteLink() { }

    public static GroupInviteLink Create(Guid groupId, Guid createdByUserId)
        => new()
        {
            GroupId = groupId,
            CreatedByUserId = createdByUserId,
            Token = Guid.NewGuid().ToString("N"),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false,
        };

    public bool IsActive => !IsRevoked && ExpiresAt > DateTime.UtcNow;

    public void Revoke()
    {
        IsRevoked = true;
        SetUpdatedAt();
    }
}
