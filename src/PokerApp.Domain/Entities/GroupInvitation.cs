using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class GroupInvitation : BaseEntity
{
    public Guid GroupId { get; private set; }
    public Group Group { get; private set; } = null!;

    public Guid InvitedByUserId { get; private set; }
    public User InvitedByUser { get; private set; } = null!;

    public Guid InvitedUserId { get; private set; }
    public User InvitedUser { get; private set; } = null!;

    public InvitationStatus Status { get; private set; }
    public DateTime? ExpiresAt { get; private set; }

    private GroupInvitation() { }

    public static GroupInvitation Create(Guid groupId, Guid invitedByUserId, Guid invitedUserId, DateTime? expiresAt = null)
        => new()
        {
            GroupId = groupId,
            InvitedByUserId = invitedByUserId,
            InvitedUserId = invitedUserId,
            Status = InvitationStatus.Pending,
            ExpiresAt = expiresAt
        };

    public void Accept() => Status = InvitationStatus.Accepted;
    public void Decline() => Status = InvitationStatus.Declined;
    public void Expire() => Status = InvitationStatus.Expired;

    public bool IsActive => Status == InvitationStatus.Pending
        && (ExpiresAt is null || ExpiresAt > DateTime.UtcNow);
}
