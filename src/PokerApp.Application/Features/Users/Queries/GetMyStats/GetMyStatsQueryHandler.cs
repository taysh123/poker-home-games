using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Users.Queries.GetMyStats;

public sealed class GetMyStatsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetMyStatsQuery, MyStatsDto>
{
    public async Task<MyStatsDto> Handle(GetMyStatsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var sessionPlayers = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sp.UserId == userId)
            .Select(sp => new { sp.Id, sp.SessionId })
            .ToListAsync(cancellationToken);

        var sessionIds = sessionPlayers.Select(x => x.SessionId).ToList();

        if (sessionIds.Count == 0)
            return new MyStatsDto(0, 0m, null, null, 0, 0, 0, 0m, 0, 0, []);

        var spIdBySession = sessionPlayers.ToDictionary(x => x.SessionId, x => x.Id);

        var allBuyIns = await context.BuyIns
            .AsNoTracking()
            .Where(b => sessionIds.Contains(b.SessionId))
            .Select(b => new { b.SessionId, b.SessionPlayerId, b.UserId, b.Amount })
            .ToListAsync(cancellationToken);

        var allCashOuts = await context.CashOuts
            .AsNoTracking()
            .Where(c => sessionIds.Contains(c.SessionId))
            .Select(c => new { c.SessionId, c.SessionPlayerId, c.UserId, c.Amount })
            .ToListAsync(cancellationToken);

        var buyInBySession = allBuyIns
            .Where(b => spIdBySession.TryGetValue(b.SessionId, out var spId) &&
                        (b.SessionPlayerId == spId || (b.SessionPlayerId == null && b.UserId == userId)))
            .GroupBy(b => b.SessionId)
            .ToDictionary(g => g.Key, g => g.Sum(b => b.Amount));

        var cashOutBySession = allCashOuts
            .Where(c => spIdBySession.TryGetValue(c.SessionId, out var spId) &&
                        (c.SessionPlayerId == spId || (c.SessionPlayerId == null && c.UserId == userId)))
            .GroupBy(c => c.SessionId)
            .ToDictionary(g => g.Key, g => g.Sum(c => c.Amount));

        var sessions = await context.Sessions
            .AsNoTracking()
            .Where(s => sessionIds.Contains(s.Id))
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        var groupIds = sessions.Select(s => s.GroupId).Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();

        var groups = await context.Groups
            .AsNoTracking()
            .Where(g => groupIds.Contains(g.Id))
            .Select(g => new { g.Id, g.Name })
            .ToDictionaryAsync(g => g.Id, g => g.Name, cancellationToken);

        var groupRoles = await context.GroupMembers
            .AsNoTracking()
            .Where(gm => gm.UserId == userId && groupIds.Contains(gm.GroupId))
            .Select(gm => new { gm.GroupId, RoleName = gm.Role.ToString() })
            .ToDictionaryAsync(x => x.GroupId, x => x.RoleName, cancellationToken);

        decimal GetProfit(Guid sessionId)
        {
            var totalIn  = buyInBySession.GetValueOrDefault(sessionId, 0m);
            var totalOut = cashOutBySession.GetValueOrDefault(sessionId, 0m);
            return totalOut - totalIn;
        }

        var finishedSessions = sessions.Where(s => s.Status == SessionStatus.Finished).ToList();
        var finishedProfits  = finishedSessions.Select(s => GetProfit(s.Id)).ToList();

        var totalProfitLoss = finishedProfits.Sum();
        var biggestWin  = finishedProfits.Any(p => p > 0) ? finishedProfits.Where(p => p > 0).Max() : (decimal?)null;
        var biggestLoss = finishedProfits.Any(p => p < 0) ? finishedProfits.Where(p => p < 0).Min() : (decimal?)null;
        var winsCount       = finishedProfits.Count(p => p > 0);
        var lossesCount     = finishedProfits.Count(p => p < 0);
        var breakEvenCount  = finishedProfits.Count(p => p == 0);
        var avgProfitLoss   = finishedProfits.Count > 0 ? totalProfitLoss / finishedProfits.Count : 0m;

        // Streak computation — finishedProfits[0] is the most recent finished session
        var currentStreak = 0;
        var longestWinStreak = 0;
        if (finishedProfits.Count > 0)
        {
            for (var i = 0; i < finishedProfits.Count; i++)
            {
                var p = finishedProfits[i];
                if (p == 0) break;
                if (i == 0) { currentStreak = p > 0 ? 1 : -1; }
                else if (currentStreak > 0 && p > 0) currentStreak++;
                else if (currentStreak < 0 && p < 0) currentStreak--;
                else break;
            }
            var tempStreak = 0;
            for (var i = finishedProfits.Count - 1; i >= 0; i--)
            {
                if (finishedProfits[i] > 0) { if (++tempStreak > longestWinStreak) longestWinStreak = tempStreak; }
                else tempStreak = 0;
            }
        }

        var allSessions = sessions.Select(s =>
        {
            var profit    = s.Status == SessionStatus.Finished ? GetProfit(s.Id) : (decimal?)null;
            var groupName = s.GroupId.HasValue ? groups.GetValueOrDefault(s.GroupId.Value, "Unknown") : "Personal";
            var userRole  = s.GroupId.HasValue ? groupRoles.GetValueOrDefault(s.GroupId.Value, "Member") : "Owner";
            return new RecentSessionDto(s.Id, s.Name, s.GroupId, groupName, userRole, s.Status.ToString(), profit, s.CreatedAt, s.StartedAt, s.EndedAt);
        }).ToList();

        return new MyStatsDto(finishedSessions.Count, totalProfitLoss, biggestWin, biggestLoss,
            winsCount, lossesCount, breakEvenCount, avgProfitLoss, currentStreak, longestWinStreak, allSessions);
    }
}
