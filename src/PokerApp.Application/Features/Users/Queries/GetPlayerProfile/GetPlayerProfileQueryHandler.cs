using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Users.Queries.GetPlayerProfile;

public sealed class GetPlayerProfileQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetPlayerProfileQuery, PlayerProfileDto>
{
    public async Task<PlayerProfileDto> Handle(GetPlayerProfileQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var target = await context.Users
            .AsNoTracking()
            .Where(u => u.Id == request.UserId)
            .Select(u => new { u.Id, u.Username })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("User", request.UserId);

        // Privacy: caller must share at least one group with the target (or be viewing own profile)
        if (callerId != request.UserId)
        {
            var callerGroupIds = await context.GroupMembers
                .AsNoTracking()
                .Where(gm => gm.UserId == callerId)
                .Select(gm => gm.GroupId)
                .ToListAsync(cancellationToken);

            var sharesGroup = await context.GroupMembers
                .AsNoTracking()
                .AnyAsync(gm => gm.UserId == request.UserId && callerGroupIds.Contains(gm.GroupId), cancellationToken);

            if (!sharesGroup)
                throw new UnauthorizedException("You do not share a group with this player.");
        }

        var sessionPlayers = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sp.UserId == request.UserId)
            .Select(sp => new { sp.Id, sp.SessionId })
            .ToListAsync(cancellationToken);

        if (sessionPlayers.Count == 0)
        {
            return new PlayerProfileDto(
                target.Id, target.Username,
                0, 0m, null, null, 0, 0, 0, 0m, 0.0,
                0, 0, [], []);
        }

        var sessionIds = sessionPlayers.Select(x => x.SessionId).ToList();
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

        var sessions = await context.Sessions
            .AsNoTracking()
            .Where(s => sessionIds.Contains(s.Id))
            .OrderByDescending(s => s.EndedAt ?? s.CreatedAt)
            .ToListAsync(cancellationToken);

        var groupIds = sessions
            .Where(s => s.GroupId.HasValue)
            .Select(s => s.GroupId!.Value)
            .Distinct()
            .ToList();

        var groups = await context.Groups
            .AsNoTracking()
            .Where(g => groupIds.Contains(g.Id))
            .Select(g => new { g.Id, g.Name })
            .ToDictionaryAsync(g => g.Id, g => g.Name, cancellationToken);

        decimal GetProfit(Guid sessionId)
        {
            var spId = spIdBySession[sessionId];
            var userId = request.UserId;
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

        var finishedSessions = sessions.Where(s => s.Status == SessionStatus.Finished).ToList();
        var profits = finishedSessions.Select(s => GetProfit(s.Id)).ToList();

        var totalPL = profits.Sum();
        var biggestWin = profits.Any(p => p > 0) ? profits.Where(p => p > 0).Max() : (decimal?)null;
        var biggestLoss = profits.Any(p => p < 0) ? profits.Where(p => p < 0).Min() : (decimal?)null;
        var winsCount = profits.Count(p => p > 0);
        var lossesCount = profits.Count(p => p < 0);
        var breakEvenCount = profits.Count(p => p == 0);
        var avg = profits.Count > 0 ? totalPL / profits.Count : 0m;
        var winRate = profits.Count > 0 ? (double)winsCount / profits.Count * 100.0 : 0.0;

        // Recent form: last 10 finished sessions oldest→newest for correct streak calculation
        var recentForm = finishedSessions
            .Take(10)
            .Select(s =>
            {
                var p = GetProfit(s.Id);
                return p > 0 ? "W" : p < 0 ? "L" : "E";
            })
            .Reverse()  // show oldest first so UI renders left-to-right chronologically
            .ToList();

        // Streak: count consecutive results from the most recent session
        var currentStreak = 0;
        if (profits.Count > 0)
        {
            var firstOutcome = profits[0] > 0 ? "W" : profits[0] < 0 ? "L" : "E";
            foreach (var p in profits)
            {
                var outcome = p > 0 ? "W" : p < 0 ? "L" : "E";
                if (outcome == firstOutcome) currentStreak++;
                else break;
            }
            if (firstOutcome != "W") currentStreak = -currentStreak; // negative = losing/even streak
        }

        // Longest win streak
        var longestWin = 0;
        var currentWin = 0;
        foreach (var p in profits.AsEnumerable().Reverse()) // oldest first for streak scan
        {
            if (p > 0) { currentWin++; longestWin = Math.Max(longestWin, currentWin); }
            else currentWin = 0;
        }

        var recentSessions = finishedSessions
            .Take(10)
            .Select(s => new ProfileSessionDto(
                s.Id,
                s.Name,
                s.GroupId,
                s.GroupId.HasValue ? groups.GetValueOrDefault(s.GroupId.Value, "Group") : "Personal",
                GetProfit(s.Id),
                s.EndedAt ?? s.CreatedAt))
            .ToList();

        return new PlayerProfileDto(
            target.Id, target.Username,
            finishedSessions.Count, totalPL, biggestWin, biggestLoss,
            winsCount, lossesCount, breakEvenCount, avg,
            Math.Round(winRate, 1),
            currentStreak, longestWin,
            recentForm, recentSessions);
    }
}
