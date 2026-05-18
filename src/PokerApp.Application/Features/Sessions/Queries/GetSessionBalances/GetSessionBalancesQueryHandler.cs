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
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        var isMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == callerId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

        var players = await context.SessionPlayers
            .Where(sp => sp.SessionId == request.SessionId)
            .Include(sp => sp.User)
            .ToListAsync(cancellationToken);

        var buyIns = await context.BuyIns
            .Where(b => b.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        var cashOuts = await context.CashOuts
            .Where(c => c.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        var playerBalances = players.Select(p =>
        {
            var totalBuyIn = buyIns.Where(b => b.UserId == p.UserId).Sum(b => b.Amount);
            var totalCashOut = cashOuts.Where(c => c.UserId == p.UserId).Sum(c => c.Amount);
            return new PlayerBalanceDto(p.UserId, p.User.Username, totalBuyIn, totalCashOut, totalCashOut - totalBuyIn);
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
