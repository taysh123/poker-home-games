using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Sessions.Queries.GetSessionBalances;

public sealed class GetSessionBalancesQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetSessionBalancesQuery, SessionBalancesDto>
{
    public async Task<SessionBalancesDto> Handle(GetSessionBalancesQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var session = await context.Sessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        bool hasAccess;
        if (session.GroupId.HasValue)
            hasAccess = await context.GroupMembers
                .AsNoTracking()
                .AnyAsync(m => m.GroupId == session.GroupId.Value && m.UserId == callerId, cancellationToken);
        else
            hasAccess = session.CreatorId == callerId;
        if (!hasAccess)
            throw new UnauthorizedException("You do not have access to this session.");

        var players = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sp.SessionId == request.SessionId)
            .Include(sp => sp.User)
            .ToListAsync(cancellationToken);

        var buyIns = await context.BuyIns
            .AsNoTracking()
            .Where(b => b.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        var cashOuts = await context.CashOuts
            .AsNoTracking()
            .Where(c => c.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        var playerBalances = players.Select(p =>
        {
            // The legacy fallback requires b.UserId != null: this runs IN MEMORY, where
            // null == null is TRUE for Guid?, so without it an ORPHANED row (both keys null —
            // deletion residue) lands on every null-UserId seat (each guest, each anonymised
            // seat), inflating their money. Orphaned rows are counted NOWHERE, mirroring the
            // orphaned-money refusal in CalculateSettlements.
            var totalBuyIn = buyIns
                .Where(b => b.SessionPlayerId == p.Id || (b.SessionPlayerId == null && b.UserId != null && b.UserId == p.UserId))
                .Sum(b => b.Amount);
            var totalCashOut = cashOuts
                .Where(c => c.SessionPlayerId == p.Id || (c.SessionPlayerId == null && c.UserId != null && c.UserId == p.UserId))
                .Sum(c => c.Amount);
            return new PlayerBalanceDto(
                p.Id,
                p.DisplayName,
                totalBuyIn,
                totalCashOut,
                totalCashOut - totalBuyIn,
                p.IsGuest,
                p.User?.AvatarEmoji,
                p.User?.AvatarColor);
        }).ToList();

        var totalPot = buyIns.Sum(b => b.Amount);

        return new SessionBalancesDto(
            session.Id,
            session.Name,
            session.Status.ToString(),
            totalPot,
            playerBalances);
    }
}
