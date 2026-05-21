using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Queries.GetSessionRecap;

public sealed class GetSessionRecapQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetSessionRecapQuery, SessionRecapDto>
{
    public async Task<SessionRecapDto> Handle(GetSessionRecapQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var session = await context.Sessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        if (session.Status != SessionStatus.Finished)
            throw new ConflictException("Recaps are only available for finished sessions.");

        bool hasAccess;
        if (session.GroupId.HasValue)
            hasAccess = await context.GroupMembers
                .AsNoTracking()
                .AnyAsync(m => m.GroupId == session.GroupId.Value && m.UserId == callerId, cancellationToken);
        else
            hasAccess = session.CreatorId == callerId;
        if (!hasAccess)
            throw new UnauthorizedException("You do not have access to this session.");

        string? groupName = null;
        if (session.GroupId.HasValue)
            groupName = await context.Groups
                .AsNoTracking()
                .Where(g => g.Id == session.GroupId.Value)
                .Select(g => g.Name)
                .FirstOrDefaultAsync(cancellationToken);

        var players = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sp.SessionId == request.SessionId)
            .Include(sp => sp.User)
            .ToListAsync(cancellationToken);

        var buyIns = await context.BuyIns
            .AsNoTracking()
            .Where(b => b.SessionId == request.SessionId)
            .Select(b => new { b.SessionPlayerId, b.UserId, b.Amount })
            .ToListAsync(cancellationToken);

        var cashOuts = await context.CashOuts
            .AsNoTracking()
            .Where(c => c.SessionId == request.SessionId)
            .Select(c => new { c.SessionPlayerId, c.UserId, c.Amount })
            .ToListAsync(cancellationToken);

        var hands = await context.HandRecords
            .AsNoTracking()
            .Where(h => h.SessionId == request.SessionId)
            .Select(h => new { h.WinnerName, h.PotAmount })
            .ToListAsync(cancellationToken);

        // Compute per-player stats
        var stats = players.Select(p =>
        {
            var totalIn = buyIns
                .Where(b => b.SessionPlayerId == p.Id || (b.SessionPlayerId == null && b.UserId == p.UserId))
                .Sum(b => b.Amount);
            var totalOut = cashOuts
                .Where(c => c.SessionPlayerId == p.Id || (c.SessionPlayerId == null && c.UserId == p.UserId))
                .Sum(c => c.Amount);
            var buyInCount = buyIns.Count(b =>
                b.SessionPlayerId == p.Id || (b.SessionPlayerId == null && b.UserId == p.UserId));
            return new PlayerStat(p.DisplayName, p.IsGuest, totalOut - totalIn, buyInCount);
        }).ToList();

        var sorted = stats.OrderByDescending(p => p.ProfitLoss).ToList();
        var totalPot = buyIns.Sum(b => b.Amount);
        var biggestPot = hands.Count > 0 ? hands.MaxBy(h => h.PotAmount) : null;
        var topWinner = sorted.FirstOrDefault(p => p.ProfitLoss > 0);
        var topLoser  = sorted.LastOrDefault(p => p.ProfitLoss < 0);

        string? duration = null;
        if (session.StartedAt.HasValue && session.EndedAt.HasValue)
        {
            var ts = session.EndedAt.Value - session.StartedAt.Value;
            duration = ts.TotalHours >= 1
                ? $"{(int)ts.TotalHours}h {ts.Minutes}m"
                : $"{ts.Minutes}m";
        }

        // Build narrative highlights
        var highlights = new List<string>();

        if (topWinner.ProfitLoss > 0)
            highlights.Add($"{topWinner.Name} was the big winner (+{Fmt(topWinner.ProfitLoss)})");

        if (topLoser.ProfitLoss < 0)
            highlights.Add($"{topLoser.Name} lost the most ({Fmt(topLoser.ProfitLoss)})");

        if (biggestPot != null)
            highlights.Add($"Biggest pot: {Fmt(biggestPot.PotAmount)} — won by {biggestPot.WinnerName}");

        var rebuyers = stats.Where(p => p.BuyInCount > 1).OrderByDescending(p => p.BuyInCount).ToList();
        if (rebuyers.Count == 1)
        {
            var extras = rebuyers[0].BuyInCount - 1;
            highlights.Add($"{rebuyers[0].Name} reloaded {extras} time{(extras > 1 ? "s" : "")}");
        }
        else if (rebuyers.Count > 1)
        {
            highlights.Add($"{rebuyers.Count} players reloaded during the game");
        }

        var winnersCount = stats.Count(p => p.ProfitLoss > 0);
        if (winnersCount > 0 && stats.Count > 1)
            highlights.Add($"{winnersCount} of {stats.Count} players finished in the black");

        if (session.StartedAt.HasValue && session.EndedAt.HasValue)
        {
            var ts = session.EndedAt.Value - session.StartedAt.Value;
            if (ts.TotalHours >= 4)
                highlights.Add($"A long night — game lasted {(int)ts.TotalHours}h {ts.Minutes}m");
        }

        var recapPlayers = sorted.Select(p => new RecapPlayerDto(p.Name, p.ProfitLoss, p.IsGuest)).ToList();

        return new SessionRecapDto(
            session.Id,
            session.Name,
            groupName,
            duration,
            session.EndedAt ?? session.CreatedAt,
            totalPot,
            players.Count,
            hands.Count,
            topWinner.ProfitLoss > 0 ? new RecapPlayerDto(topWinner.Name, topWinner.ProfitLoss, topWinner.IsGuest) : null,
            topLoser.ProfitLoss  < 0 ? new RecapPlayerDto(topLoser.Name,  topLoser.ProfitLoss,  topLoser.IsGuest)  : null,
            biggestPot?.PotAmount,
            biggestPot?.WinnerName,
            recapPlayers,
            highlights);
    }

    private static string Fmt(decimal amount)
    {
        var abs = Math.Abs(Math.Round(amount));
        return amount >= 0 ? $"₪{abs:N0}" : $"-₪{abs:N0}";
    }

    private readonly record struct PlayerStat(string Name, bool IsGuest, decimal ProfitLoss, int BuyInCount);
}
