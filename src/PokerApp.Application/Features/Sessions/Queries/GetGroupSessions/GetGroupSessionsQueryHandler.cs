using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Sessions.Queries.GetGroupSessions;

public sealed class GetGroupSessionsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetGroupSessionsQuery, IReadOnlyList<SessionSummaryDto>>
{
    public async Task<IReadOnlyList<SessionSummaryDto>> Handle(GetGroupSessionsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var groupExists = await context.Groups
            .AnyAsync(g => g.Id == request.GroupId, cancellationToken);

        if (!groupExists)
            throw new NotFoundException(nameof(Group), request.GroupId);

        var isMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == request.GroupId && m.UserId == userId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

        var sessions = await context.Sessions
            .Where(s => s.GroupId == request.GroupId)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SessionSummaryDto(
                s.Id,
                s.Name,
                s.Status.ToString(),
                s.SessionPlayers.Count,
                s.StartedAt,
                s.EndedAt,
                s.CreatedAt))
            .ToListAsync(cancellationToken);

        return sessions;
    }
}
