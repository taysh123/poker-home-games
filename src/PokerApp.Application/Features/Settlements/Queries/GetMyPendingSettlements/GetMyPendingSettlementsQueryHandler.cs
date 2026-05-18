using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Settlements.Queries.GetMyPendingSettlements;

public sealed class GetMyPendingSettlementsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetMyPendingSettlementsQuery, List<MyPendingSettlementDto>>
{
    public async Task<List<MyPendingSettlementDto>> Handle(
        GetMyPendingSettlementsQuery request,
        CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        return await context.Settlements
            .AsNoTracking()
            .Where(s => s.Status == SettlementStatus.Pending
                     && (s.PayerUserId == userId || s.ReceiverUserId == userId))
            .Include(s => s.Session).ThenInclude(s => s.Group)
            .Include(s => s.PayerUser)
            .Include(s => s.ReceiverUser)
            .OrderBy(s => s.CreatedAt)
            .Select(s => new MyPendingSettlementDto(
                s.Id,
                s.SessionId,
                s.Session.Name,
                s.Session.Group.Name,
                s.PayerUserId,
                s.PayerUser.Username,
                s.ReceiverUserId,
                s.ReceiverUser.Username,
                s.Amount
            ))
            .ToListAsync(cancellationToken);
    }
}
