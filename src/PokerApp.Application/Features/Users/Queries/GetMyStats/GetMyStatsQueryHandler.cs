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
            return new MyStatsDto(0, 0m, null, null, []);

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

        var groupIds = sessions.Select(s => s.GroupId).Distinct().ToList();

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

        var recentSessions = sessions.Take(8).Select(s =>
        {
            var profit   = s.Status == SessionStatus.Finished ? GetProfit(s.Id) : (decimal?)null;
            var groupName = groups.GetValueOrDefault(s.GroupId, "Unknown");
            var userRole  = groupRoles.GetValueOrDefault(s.GroupId, "Member");
            return new RecentSessionDto(s.Id, s.Name, s.GroupId, groupName, userRole, s.Status.ToString(), profit, s.CreatedAt);
        }).ToList();

        return new MyStatsDto(finishedSessions.Count, totalProfitLoss, biggestWin, biggestLoss, recentSessions);
    }
}
