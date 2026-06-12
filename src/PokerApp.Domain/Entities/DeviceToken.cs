namespace PokerApp.Domain.Entities;

public class DeviceToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Token { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public static DeviceToken Create(Guid userId, string token, string platform)
        => new()
        {
            UserId   = userId,
            Token    = token,
            Platform = platform,
            IsActive = true,
        };

    public void ReassignTo(Guid userId, string platform)
    {
        UserId   = userId;
        Platform = platform;
        IsActive = true;
        SetUpdatedAt();
    }

    public void Deactivate()
    {
        IsActive = false;
        SetUpdatedAt();
    }
}
