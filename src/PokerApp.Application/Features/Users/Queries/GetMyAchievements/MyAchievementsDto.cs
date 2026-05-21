namespace PokerApp.Application.Features.Users.Queries.GetMyAchievements;

public sealed record MyAchievementsDto(
    List<AchievementDto> Earned,
    List<AchievementDto> Locked
);

public sealed record AchievementDto(
    string Key,
    string Name,
    string Description,
    string IconKey,
    string Rarity,
    DateTime? UnlockedAt
);
