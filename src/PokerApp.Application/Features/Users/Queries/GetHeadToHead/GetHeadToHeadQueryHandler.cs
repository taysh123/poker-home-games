using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Users.Queries.GetHeadToHead;

public sealed class GetHeadToHeadQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetHeadToHeadQuery, HeadToHeadDto>
{
    public async Task<HeadToHeadDto> Handle(GetHeadToHeadQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var opponent = await context.Users
            .AsNoTracking()
            .Where(u => u.Id == request.OpponentId)
            .Select(u => new { u.Id, u.Username })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("User", request.OpponentId);

        // Both users must share at least one group
        var callerGroupIds = await context.GroupMembers
            .AsNoTracking()
            .Where(gm => gm.UserId == callerId)
            .Select(gm => gm.GroupId)
            .ToListAsync(cancellationToken);

        var sharesGroup = await context.GroupMembers
            .AsNoTracking()
            .AnyAsync(gm => gm.UserId == request.OpponentId && callerGroupIds.Contains(gm.GroupId), cancellationToken);

        if (!sharesGroup)
            throw new UnauthorizedException("You do not share a group with this player.");

        // Sessions where the caller played
        var mySessionPlayers = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sp.UserId == callerId)
            .Select(sp => new { sp.Id, sp.SessionId })
            .ToListAsync(cancellationToken);

        var mySessionIds = mySessionPlayers.Select(x => x.SessionId).ToHashSet();

        // Sessions where the opponent played — intersect with caller's sessions
        var opponentSessionPlayers = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sp.UserId == request.OpponentId && mySessionIds.Contains(sp.SessionId))
            .Select(sp => new { sp.Id, sp.SessionId })
            .ToListAsync(cancellationToken);

        var sharedSessionIds = opponentSessionPlayers.Select(x => x.SessionId).ToHashSet();

        if (sharedSessionIds.Count == 0)
        {
            return new HeadToHeadDto(
                opponent.Id, opponent.Username,
                0, 0, 0, 0, 0m, null, []);
        }

        var mySpBySession = mySessionPlayers
            .Where(x => sharedSessionIds.Contains(x.SessionId))
            .ToDictionary(x => x.SessionId, x => x.Id);
        var opponentSpBySession = opponentSessionPlayers.ToDictionary(x => x.SessionId, x => x.Id);

        var sessions = await context.Sessions
            .AsNoTracking()
            .Where(s => sharedSessionIds.Contains(s.Id) && s.Status == SessionStatus.Finished)
            .OrderByDescending(s => s.EndedAt ?? s.CreatedAt)
            .ToListAsync(cancellationToken);

        if (sessions.Count == 0)
        {
            return new HeadToHeadDto(
                opponent.Id, opponent.Username,
                0, 0, 0, 0, 0m, null, []);
        }

        var finishedIds = sessions.Select(s => s.Id).ToList();

        var allBuyIns = await context.BuyIns
            .AsNoTracking()
            .Where(b => finishedIds.Contains(b.SessionId))
            .Select(b => new { b.SessionId, b.SessionPlayerId, b.UserId, b.Amount })
            .ToListAsync(cancellationToken);

        var allCashOuts = await context.CashOuts
            .AsNoTracking()
            .Where(c => finishedIds.Contains(c.SessionId))
            .Select(c => new { c.SessionId, c.SessionPlayerId, c.UserId, c.Amount })
            .ToListAsync(cancellationToken);

        var groupIds = sessions.Where(s => s.GroupId.HasValue).Select(s => s.GroupId!.Value).Distinct().ToList();
        var groups = await context.Groups
            .AsNoTracking()
            .Where(g => groupIds.Contains(g.Id))
            .Select(g => new { g.Id, g.Name })
            .ToDictionaryAsync(g => g.Id, g => g.Name, cancellationToken);

        decimal GetProfit(Guid sessionId, Guid userId, Guid spId)
        {
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

        var myWins = 0;
        var opponentWins = 0;
        var ties = 0;
        var myTotalProfit = 0m;

        var matchups = sessions.Select(s =>
        {
            var mySpId = mySpBySession[s.Id];
            var opSpId = opponentSpBySession[s.Id];
            var myPL = GetProfit(s.Id, callerId, mySpId);
            var opPL = GetProfit(s.Id, request.OpponentId, opSpId);

            if (myPL > opPL) myWins++;
            else if (opPL > myPL) opponentWins++;
            else ties++;

            myTotalProfit += myPL;

            return new H2HMatchupDto(
                s.Id,
                s.Name,
                s.GroupId.HasValue ? groups.GetValueOrDefault(s.GroupId.Value, "Group") : "Personal",
                myPL,
                opPL,
                s.EndedAt ?? s.CreatedAt);
        }).ToList();

        var lastPlayed = sessions.FirstOrDefault()?.EndedAt ?? sessions.FirstOrDefault()?.CreatedAt;

        return new HeadToHeadDto(
            opponent.Id, opponent.Username,
            sessions.Count, myWins, opponentWins, ties,
            myTotalProfit, lastPlayed,
            matchups.Take(5).ToList());
    }
}
