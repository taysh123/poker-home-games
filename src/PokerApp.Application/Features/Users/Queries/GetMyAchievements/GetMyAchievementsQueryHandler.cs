using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Users.Queries.GetMyAchievements;

public sealed class GetMyAchievementsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetMyAchievementsQuery, MyAchievementsDto>
{
    public async Task<MyAchievementsDto> Handle(GetMyAchievementsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var allAchievements = await context.Achievements
            .AsNoTracking()
            .OrderBy(a => a.Rarity)
            .ThenBy(a => a.Name)
            .ToListAsync(cancellationToken);

        var earned = await context.UserAchievements
            .AsNoTracking()
            .Where(ua => ua.UserId == userId)
            .ToListAsync(cancellationToken);

        var earnedKeys = earned.ToDictionary(ua => ua.AchievementKey, ua => ua.UnlockedAt);

        var earnedDtos = allAchievements
            .Where(a => earnedKeys.ContainsKey(a.Key))
            .Select(a => new AchievementDto(a.Key, a.Name, a.Description, a.IconKey, a.Rarity.ToString(), earnedKeys[a.Key]))
            .OrderByDescending(a => a.UnlockedAt)
            .ToList();

        var lockedDtos = allAchievements
            .Where(a => !earnedKeys.ContainsKey(a.Key))
            .Select(a => new AchievementDto(a.Key, a.Name, a.Description, a.IconKey, a.Rarity.ToString(), null))
            .ToList();

        return new MyAchievementsDto(earnedDtos, lockedDtos);
    }
}
