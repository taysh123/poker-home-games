using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Settlements.Queries.GetSessionSettlements;

public sealed class GetSessionSettlementsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetSessionSettlementsQuery, SessionSettlementsDto>
{
    public async Task<SessionSettlementsDto> Handle(GetSessionSettlementsQuery request, CancellationToken cancellationToken)
    {
        var session = await context.Sessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        var callerId = currentUserService.UserId;
        var callerIsMember = await context.GroupMembers
            .AsNoTracking()
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == callerId, cancellationToken);

        if (!callerIsMember)
            throw new UnauthorizedException("You are not a member of this group.");

        var totalPot = await context.BuyIns
            .AsNoTracking()
            .Where(b => b.SessionId == request.SessionId)
            .SumAsync(b => b.Amount, cancellationToken);

        var settlements = await context.Settlements
            .AsNoTracking()
            .Where(s => s.SessionId == request.SessionId)
            .Include(s => s.PayerUser)
            .Include(s => s.ReceiverUser)
            .OrderBy(s => s.CreatedAt)
            .Select(s => new SettlementDto(
                s.Id,
                s.PayerUserId,
                s.PayerUser != null ? s.PayerUser.Username : "Unknown",
                s.ReceiverUserId,
                s.ReceiverUser != null ? s.ReceiverUser.Username : "Unknown",
                s.Amount,
                s.Status.ToString()
            ))
            .ToListAsync(cancellationToken);

        return new SessionSettlementsDto(request.SessionId, totalPot, settlements);
    }
}
