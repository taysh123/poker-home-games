using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Sessions.Queries.GetSessionHandHistory;

public sealed class GetSessionHandHistoryQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetSessionHandHistoryQuery, IReadOnlyList<HandRecordDto>>
{
    public async Task<IReadOnlyList<HandRecordDto>> Handle(GetSessionHandHistoryQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var session = await context.Sessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        var isMember = await context.GroupMembers
            .AsNoTracking()
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == userId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

        return await context.HandRecords
            .AsNoTracking()
            .Where(h => h.SessionId == request.SessionId)
            .OrderBy(h => h.CreatedAt)
            .Select(h => new HandRecordDto(h.Id, h.WinnerName, h.PotAmount, h.Note, h.CreatedByUserId, h.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}
