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

        var isMember = await context.GroupMembers
            .AsNoTracking()
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == callerId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

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
            var totalBuyIn = buyIns
                .Where(b => b.SessionPlayerId == p.Id || (b.SessionPlayerId == null && b.UserId == p.UserId))
                .Sum(b => b.Amount);
            var totalCashOut = cashOuts
                .Where(c => c.SessionPlayerId == p.Id || (c.SessionPlayerId == null && c.UserId == p.UserId))
                .Sum(c => c.Amount);
            return new PlayerBalanceDto(p.Id, p.DisplayName, totalBuyIn, totalCashOut, totalCashOut - totalBuyIn, p.IsGuest);
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
