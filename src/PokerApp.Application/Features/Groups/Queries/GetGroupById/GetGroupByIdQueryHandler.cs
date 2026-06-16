using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupById;

public sealed class GetGroupByIdQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetGroupByIdQuery, GetGroupByIdResponse>
{
    public async Task<GetGroupByIdResponse> Handle(GetGroupByIdQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var isMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == request.GroupId && m.UserId == callerId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

        var group = await context.Groups
            .AsNoTracking()
            .Include(g => g.Owner)
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == request.GroupId, cancellationToken)
            ?? throw new NotFoundException(nameof(Group), request.GroupId);

        var finishedSessionIds = await context.Sessions
            .AsNoTracking()
            .Where(s => s.GroupId == request.GroupId && s.Status == Domain.Enums.SessionStatus.Finished)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        var totalMoneyMoved = finishedSessionIds.Count > 0
            ? await context.BuyIns
                .AsNoTracking()
                .Where(b => finishedSessionIds.Contains(b.SessionId))
                .SumAsync(b => b.Amount, cancellationToken)
            : 0;

        var myRole = group.Members
            .FirstOrDefault(m => m.UserId == callerId)?.Role.ToString() ?? "Member";

        return new GetGroupByIdResponse(
            group.Id,
            group.Name,
            group.Description,
            group.OwnerId,
            group.Owner.Username,
            group.Members.Count,
            group.CreatedAt,
            myRole,
            finishedSessionIds.Count,
            totalMoneyMoved);
    }
}
