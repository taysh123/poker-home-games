using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Groups.Queries.GetCrossGroupActivity;

public sealed class GetCrossGroupActivityQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetCrossGroupActivityQuery, List<CrossGroupActivityDto>>
{
    public async Task<List<CrossGroupActivityDto>> Handle(
        GetCrossGroupActivityQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var groupIds = await context.GroupMembers
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => m.GroupId)
            .ToListAsync(cancellationToken);

        if (groupIds.Count == 0) return [];

        var logs = await context.ActivityLogs
            .AsNoTracking()
            .Where(a => groupIds.Contains(a.GroupId))
            .OrderByDescending(a => a.CreatedAt)
            .Take(10)
            .Select(a => new CrossGroupActivityDto(
                a.Id,
                a.GroupId,
                a.Group.Name,
                a.ActorName,
                a.Type.ToString(),
                a.Description,
                a.CreatedAt))
            .ToListAsync(cancellationToken);

        return logs;
    }
}
