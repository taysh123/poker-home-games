using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupLeaderboard;

public sealed class GetGroupLeaderboardQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetGroupLeaderboardQuery, List<PlayerLeaderboardEntryDto>>
{
    public async Task<List<PlayerLeaderboardEntryDto>> Handle(GetGroupLeaderboardQuery request, CancellationToken cancellationToken)
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

        // Only registered players (IsGuest = false, meaning UserId is not null)
        var sessionPlayers = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => finishedSessionIds.Contains(sp.SessionId) && sp.UserId != null)
            .Select(sp => new { sp.Id, sp.SessionId, sp.UserId })
            .ToListAsync(cancellationToken);

        var allUserIds = sessionPlayers.Select(sp => sp.UserId!.Value).Distinct().ToList();

        var usernames = await context.Users
            .AsNoTracking()
            .Where(u => allUserIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Username })
            .ToDictionaryAsync(u => u.Id, u => u.Username, cancellationToken);

        var spIds = sessionPlayers.Select(sp => sp.Id).ToHashSet();

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

        // Group SessionPlayers by UserId so we can aggregate across all sessions per user
        var playersByUser = sessionPlayers
            .GroupBy(sp => sp.UserId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var entries = playersByUser.Select(kvp =>
        {
            var uid = kvp.Key;
            var players = kvp.Value;
            var sessionProfits = new List<decimal>();

            foreach (var sp in players)
            {
                var totalIn = allBuyIns
                    .Where(b => b.SessionId == sp.SessionId &&
                                (b.SessionPlayerId == sp.Id || (b.SessionPlayerId == null && b.UserId == uid)))
                    .Sum(b => b.Amount);
                var totalOut = allCashOuts
                    .Where(c => c.SessionId == sp.SessionId &&
                                (c.SessionPlayerId == sp.Id || (c.SessionPlayerId == null && c.UserId == uid)))
                    .Sum(c => c.Amount);
                sessionProfits.Add(totalOut - totalIn);
            }

            var totalPL = sessionProfits.Sum();
            var biggestWin = sessionProfits.Any(p => p > 0) ? sessionProfits.Where(p => p > 0).Max() : (decimal?)null;
            var biggestLoss = sessionProfits.Any(p => p < 0) ? sessionProfits.Where(p => p < 0).Min() : (decimal?)null;
            var winsCount = sessionProfits.Count(p => p > 0);
            var avgPL = sessionProfits.Count > 0 ? totalPL / sessionProfits.Count : 0m;

            return new PlayerLeaderboardEntryDto(
                uid,
                usernames.GetValueOrDefault(uid, "Unknown"),
                players.Count,
                totalPL,
                biggestWin,
                biggestLoss,
                winsCount,
                avgPL);
        })
        .OrderByDescending(e => e.TotalProfitLoss)
        .ToList();

        return entries;
    }
}
