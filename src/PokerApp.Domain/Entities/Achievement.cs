using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class Achievement
{
    public Guid Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string IconKey { get; set; } = string.Empty;
    public AchievementRarity Rarity { get; set; }
}
