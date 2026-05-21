namespace PokerApp.Domain.Entities;

public class UserAchievement : BaseEntity
{
    public Guid UserId { get; private set; }
    public User? User { get; private set; }
    public string AchievementKey { get; private set; } = string.Empty;
    public DateTime UnlockedAt { get; private set; }

    private UserAchievement() { }

    public static UserAchievement Create(Guid userId, string key)
        => new() { UserId = userId, AchievementKey = key, UnlockedAt = DateTime.UtcNow };
}
