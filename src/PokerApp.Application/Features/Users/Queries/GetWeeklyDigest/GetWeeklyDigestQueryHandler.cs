using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Users.Queries.GetWeeklyDigest;

public sealed class GetWeeklyDigestQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetWeeklyDigestQuery, WeeklyDigestDto>
{
    public async Task<WeeklyDigestDto> Handle(GetWeeklyDigestQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var sessionPlayers = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sp.UserId == userId)
            .Select(sp => new { sp.Id, sp.SessionId })
            .ToListAsync(cancellationToken);

        var sessionIds = sessionPlayers.Select(x => x.SessionId).ToList();

        if (sessionIds.Count == 0)
            return new WeeklyDigestDto(0, 0m, null, 0, null, 0);

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

        // SessionPlayerId match with legacy UserId fallback — same pattern as GetMyStatsQueryHandler
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

        decimal GetProfit(Guid sessionId)
        {
            var totalIn  = buyInBySession.GetValueOrDefault(sessionId, 0m);
            var totalOut = cashOutBySession.GetValueOrDefault(sessionId, 0m);
            return totalOut - totalIn;
        }

        var sessions = await context.Sessions
            .AsNoTracking()
            .Where(s => sessionIds.Contains(s.Id))
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        var allFinishedSessions = sessions.Where(s => s.Status == SessionStatus.Finished).ToList();

        // Streak is always lifetime — same computation as GetMyStatsQueryHandler
        var allFinishedProfits = allFinishedSessions.Select(s => GetProfit(s.Id)).ToList();
        var currentStreak = 0;
        for (var i = 0; i < allFinishedProfits.Count; i++)
        {
            var p = allFinishedProfits[i];
            if (p == 0) break;
            if (i == 0) { currentStreak = p > 0 ? 1 : -1; }
            else if (currentStreak > 0 && p > 0) currentStreak++;
            else if (currentStreak < 0 && p < 0) currentStreak--;
            else break;
        }

        // Last 7 days (UTC), finished sessions only — same cutoff semantics as stats "week" period
        var cutoff = DateTime.UtcNow.AddDays(-7);
        var weekSessions = allFinishedSessions.Where(s => s.CreatedAt >= cutoff).ToList();

        if (weekSessions.Count == 0)
            return new WeeklyDigestDto(0, 0m, null, 0, null, currentStreak);

        var weekProfits = weekSessions.Select(s => (Session: s, Profit: GetProfit(s.Id))).ToList();

        var netProfitLoss = weekProfits.Sum(x => x.Profit);

        var best = weekProfits.OrderByDescending(x => x.Profit).First();
        var bestNight = new BestNightDto(best.Session.Id, best.Session.Name, best.Profit);

        var totalMinutesPlayed = (int)weekSessions
            .Where(s => s.StartedAt.HasValue && s.EndedAt.HasValue)
            .Sum(s => (long)(s.EndedAt!.Value - s.StartedAt!.Value).TotalMinutes);

        MostActiveGroupDto? mostActiveGroup = null;
        var topGroup = weekSessions
            .Where(s => s.GroupId.HasValue)
            .GroupBy(s => s.GroupId!.Value)
            .Select(g => new { GroupId = g.Key, GamesCount = g.Count() })
            .OrderByDescending(g => g.GamesCount)
            .FirstOrDefault();

        if (topGroup is not null)
        {
            var groupName = await context.Groups
                .AsNoTracking()
                .Where(g => g.Id == topGroup.GroupId)
                .Select(g => g.Name)
                .FirstOrDefaultAsync(cancellationToken) ?? "Unknown";

            mostActiveGroup = new MostActiveGroupDto(topGroup.GroupId, groupName, topGroup.GamesCount);
        }

        return new WeeklyDigestDto(
            weekSessions.Count,
            netProfitLoss,
            bestNight,
            totalMinutesPlayed,
            mostActiveGroup,
            currentStreak);
    }
}
