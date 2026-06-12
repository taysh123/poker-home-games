using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupActivity;

public sealed class GetGroupActivityQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUser) : IRequestHandler<GetGroupActivityQuery, List<ActivityLogDto>>
{
    public async Task<List<ActivityLogDto>> Handle(
        GetGroupActivityQuery request,
        CancellationToken cancellationToken)
    {
        var isMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == request.GroupId && m.UserId == currentUser.UserId, cancellationToken);
        if (!isMember)
            throw new UnauthorizedAccessException("You are not a member of this group.");

        var skip = Math.Max(request.Skip, 0);
        var take = Math.Clamp(request.Take, 1, GetGroupActivityQuery.MaxTake);

        var logs = await context.ActivityLogs
            .Where(a => a.GroupId == request.GroupId)
            .OrderByDescending(a => a.CreatedAt)
            .Skip(skip)
            .Take(take)
            .Select(a => new ActivityLogDto(
                a.Id,
                a.ActorName,
                a.Type.ToString(),
                a.Description,
                a.CreatedAt,
                a.RelatedSessionId))
            .ToListAsync(cancellationToken);

        return logs;
    }
}
