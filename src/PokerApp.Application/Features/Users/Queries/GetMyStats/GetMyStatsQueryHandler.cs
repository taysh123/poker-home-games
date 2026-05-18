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

        var sessionIds = await context.SessionPlayers
            .Where(sp => sp.UserId == userId)
            .Select(sp => sp.SessionId)
            .ToListAsync(cancellationToken);

        if (sessionIds.Count == 0)
            return new MyStatsDto(0, 0m, null, null, []);

        var buyInSums = await context.BuyIns
            .Where(b => b.UserId == userId && sessionIds.Contains(b.SessionId))
            .GroupBy(b => b.SessionId)
            .Select(g => new { SessionId = g.Key, Total = g.Sum(b => b.Amount) })
            .ToListAsync(cancellationToken);

        var cashOutSums = await context.CashOuts
            .Where(c => c.UserId == userId && sessionIds.Contains(c.SessionId))
            .GroupBy(c => c.SessionId)
            .Select(g => new { SessionId = g.Key, Total = g.Sum(c => c.Amount) })
            .ToListAsync(cancellationToken);

        var sessions = await context.Sessions
            .Where(s => sessionIds.Contains(s.Id))
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        var groupIds = sessions.Select(s => s.GroupId).Distinct().ToList();

        var groups = await context.Groups
            .Where(g => groupIds.Contains(g.Id))
            .Select(g => new { g.Id, g.Name })
            .ToDictionaryAsync(g => g.Id, g => g.Name, cancellationToken);

        var groupRoles = await context.GroupMembers
            .Where(gm => gm.UserId == userId && groupIds.Contains(gm.GroupId))
            .Select(gm => new { gm.GroupId, RoleName = gm.Role.ToString() })
            .ToDictionaryAsync(x => x.GroupId, x => x.RoleName, cancellationToken);

        // Profit/loss = cashOut - buyIn per session
        decimal GetProfit(Guid sessionId)
        {
            var totalIn  = buyInSums.FirstOrDefault(b => b.SessionId == sessionId)?.Total ?? 0m;
            var totalOut = cashOutSums.FirstOrDefault(c => c.SessionId == sessionId)?.Total ?? 0m;
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
