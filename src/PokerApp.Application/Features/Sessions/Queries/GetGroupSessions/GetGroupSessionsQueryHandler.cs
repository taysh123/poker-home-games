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
            .AsNoTracking()
            .AnyAsync(g => g.Id == request.GroupId, cancellationToken);

        if (!groupExists)
            throw new NotFoundException(nameof(Group), request.GroupId);

        var isMember = await context.GroupMembers
            .AsNoTracking()
            .AnyAsync(m => m.GroupId == request.GroupId && m.UserId == userId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

        var sessions = await context.Sessions
            .AsNoTracking()
            .Where(s => s.GroupId == request.GroupId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        var sessionIds = sessions.Select(s => s.Id).ToList();

        // Load caller's SessionPlayer rows for these sessions
        var mySessionPlayers = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sp.UserId == userId && sessionIds.Contains(sp.SessionId))
            .Select(sp => new { sp.Id, sp.SessionId })
            .ToListAsync(cancellationToken);

        var spBySession = mySessionPlayers.ToDictionary(sp => sp.SessionId, sp => sp.Id);
        var finishedIds = sessions
            .Where(s => s.Status == Domain.Enums.SessionStatus.Finished && spBySession.ContainsKey(s.Id))
            .Select(s => s.Id)
            .ToHashSet();

        var buyIns = finishedIds.Count > 0
            ? await context.BuyIns
                .AsNoTracking()
                .Where(b => finishedIds.Contains(b.SessionId))
                .Select(b => new { b.SessionId, b.SessionPlayerId, b.UserId, b.Amount })
                .ToListAsync(cancellationToken)
            : [];

        var cashOuts = finishedIds.Count > 0
            ? await context.CashOuts
                .AsNoTracking()
                .Where(c => finishedIds.Contains(c.SessionId))
                .Select(c => new { c.SessionId, c.SessionPlayerId, c.UserId, c.Amount })
                .ToListAsync(cancellationToken)
            : [];

        decimal? GetMyProfitLoss(Guid sessionId)
        {
            if (!finishedIds.Contains(sessionId) || !spBySession.TryGetValue(sessionId, out var spId))
                return null;
            var totalIn  = buyIns.Where(b => b.SessionId == sessionId &&
                               (b.SessionPlayerId == spId || (b.SessionPlayerId == null && b.UserId == userId)))
                               .Sum(b => b.Amount);
            var totalOut = cashOuts.Where(c => c.SessionId == sessionId &&
                               (c.SessionPlayerId == spId || (c.SessionPlayerId == null && c.UserId == userId)))
                               .Sum(c => c.Amount);
            return totalOut - totalIn;
        }

        var playerCounts = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sessionIds.Contains(sp.SessionId))
            .GroupBy(sp => sp.SessionId)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SessionId, x => x.Count, cancellationToken);

        return sessions.Select(s => new SessionSummaryDto(
            s.Id,
            s.Name,
            s.Status.ToString(),
            playerCounts.GetValueOrDefault(s.Id, 0),
            s.StartedAt,
            s.EndedAt,
            s.CreatedAt,
            GetMyProfitLoss(s.Id)))
            .ToList();
    }
}
