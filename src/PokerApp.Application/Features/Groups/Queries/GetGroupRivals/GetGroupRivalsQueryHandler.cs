using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupRivals;

public sealed class GetGroupRivalsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetGroupRivalsQuery, List<GroupRivalryDto>>
{
    public async Task<List<GroupRivalryDto>> Handle(GetGroupRivalsQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var isMember = await context.GroupMembers
            .AsNoTracking()
            .AnyAsync(m => m.GroupId == request.GroupId && m.UserId == callerId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

        var finishedSessionIds = await context.Sessions
            .AsNoTracking()
            .Where(s => s.GroupId == request.GroupId && s.Status == SessionStatus.Finished)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        if (finishedSessionIds.Count == 0)
            return [];

        var sessionPlayers = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => finishedSessionIds.Contains(sp.SessionId) && sp.UserId != null)
            .Select(sp => new { sp.Id, sp.SessionId, UserId = sp.UserId!.Value })
            .ToListAsync(cancellationToken);

        var userIds = sessionPlayers.Select(sp => sp.UserId).Distinct().ToList();
        if (userIds.Count < 2) return [];

        var usernames = await context.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Username })
            .ToDictionaryAsync(u => u.Id, u => u.Username, cancellationToken);

        var allBuyIns = await context.BuyIns
            .AsNoTracking()
            .Where(b => finishedSessionIds.Contains(b.SessionId))
            .Select(b => new { b.SessionId, b.SessionPlayerId, b.UserId, b.Amount })
            .ToListAsync(cancellationToken);

        var allCashOuts = await context.CashOuts
            .AsNoTracking()
            .Where(c => finishedSessionIds.Contains(c.SessionId))
            .Select(c => new { c.SessionId, c.SessionPlayerId, c.UserId, c.Amount })
            .ToListAsync(cancellationToken);

        // Build map: sessionId -> list of userIds who played
        var playersBySession = sessionPlayers
            .GroupBy(sp => sp.SessionId)
            .ToDictionary(g => g.Key, g => g.Select(sp => sp.UserId).Distinct().ToList());

        // Build map: (sessionId, userId) -> sessionPlayerId
        var spIdMap = sessionPlayers.ToDictionary(sp => (sp.SessionId, sp.UserId), sp => sp.Id);

        decimal GetSessionPL(Guid sessionId, Guid userId)
        {
            spIdMap.TryGetValue((sessionId, userId), out var spId);
            var totalIn = allBuyIns
                .Where(b => b.SessionId == sessionId &&
                            (b.SessionPlayerId == spId || (b.SessionPlayerId == null && b.UserId == userId)))
                .Sum(b => b.Amount);
            var totalOut = allCashOuts
                .Where(c => c.SessionId == sessionId &&
                            (c.SessionPlayerId == spId || (c.SessionPlayerId == null && c.UserId == userId)))
                .Sum(c => c.Amount);
            return totalOut - totalIn;
        }

        // Accumulate pair stats
        var pairStats = new Dictionary<(Guid, Guid), (int sessions, decimal pl1, decimal pl2)>();

        foreach (var (sid, players) in playersBySession)
        {
            if (players.Count < 2) continue;
            for (var i = 0; i < players.Count; i++)
            for (var j = i + 1; j < players.Count; j++)
            {
                var a = players[i] < players[j] ? players[i] : players[j];
                var b = players[i] < players[j] ? players[j] : players[i];
                var key = (a, b);

                var pl1 = GetSessionPL(sid, a);
                var pl2 = GetSessionPL(sid, b);

                if (pairStats.TryGetValue(key, out var existing))
                    pairStats[key] = (existing.sessions + 1, existing.pl1 + pl1, existing.pl2 + pl2);
                else
                    pairStats[key] = (1, pl1, pl2);
            }
        }

        return pairStats
            .OrderByDescending(kv => kv.Value.sessions)
            .Take(5)
            .Select(kv => new GroupRivalryDto(
                kv.Key.Item1,
                usernames.GetValueOrDefault(kv.Key.Item1, "Unknown"),
                kv.Value.pl1,
                kv.Key.Item2,
                usernames.GetValueOrDefault(kv.Key.Item2, "Unknown"),
                kv.Value.pl2,
                kv.Value.sessions))
            .ToList();
    }
}
