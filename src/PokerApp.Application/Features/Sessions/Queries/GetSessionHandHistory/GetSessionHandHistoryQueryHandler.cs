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

        bool hasAccess;
        if (session.GroupId.HasValue)
            hasAccess = await context.GroupMembers
                .AsNoTracking()
                .AnyAsync(m => m.GroupId == session.GroupId.Value && m.UserId == userId, cancellationToken);
        else
            hasAccess = session.CreatorId == userId;
        if (!hasAccess)
            throw new UnauthorizedException("You do not have access to this session.");

        return await context.HandRecords
            .AsNoTracking()
            .Where(h => h.SessionId == request.SessionId)
            .OrderBy(h => h.CreatedAt)
            // The transitional CreatedByUserId is the CALLER'S OWN id or nothing — never the raw
            // author id. Same predicate as IsMine, so the two cannot disagree, and no identifier
            // the caller did not already have leaves the database. See HandRecordDto.
            .Select(h => new HandRecordDto(h.Id, h.WinnerName, h.PotAmount, h.Note,
                h.CreatedByUserId == userId,
                h.CreatedByUserId == userId ? userId : Guid.Empty,
                h.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}
