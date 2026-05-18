using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Queries.GetMyInvitations;

public sealed class GetMyInvitationsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetMyInvitationsQuery, IReadOnlyList<PendingInvitationDto>>
{
    public async Task<IReadOnlyList<PendingInvitationDto>> Handle(GetMyInvitationsQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;
        var now = DateTime.UtcNow;

        return await context.GroupInvitations
            .AsNoTracking()
            .Where(i => i.InvitedUserId == callerId
                     && i.Status == InvitationStatus.Pending
                     && (i.ExpiresAt == null || i.ExpiresAt > now))
            .Include(i => i.Group)
            .Include(i => i.InvitedByUser)
            .OrderBy(i => i.CreatedAt)
            .Select(i => new PendingInvitationDto(
                i.Id,
                i.GroupId,
                i.Group != null ? i.Group.Name : "Unknown",
                i.InvitedByUser != null ? i.InvitedByUser.Username : "Unknown",
                i.ExpiresAt.HasValue ? i.ExpiresAt.Value : DateTime.MaxValue,
                i.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}
