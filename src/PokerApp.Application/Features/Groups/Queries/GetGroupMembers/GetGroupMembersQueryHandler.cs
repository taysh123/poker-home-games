using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupMembers;

public sealed class GetGroupMembersQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetGroupMembersQuery, IReadOnlyList<GroupMemberDto>>
{
    public async Task<IReadOnlyList<GroupMemberDto>> Handle(GetGroupMembersQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var isMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == request.GroupId && m.UserId == callerId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

        return await context.GroupMembers
            .AsNoTracking()
            .Where(m => m.GroupId == request.GroupId)
            .Include(m => m.User)
            .OrderBy(m => m.JoinedAt)
            .Select(m => new GroupMemberDto(
                m.UserId,
                m.User.Username,
                m.Role.ToString(),
                m.JoinedAt,
                m.User.AvatarEmoji,
                m.User.AvatarColor))
            .ToListAsync(cancellationToken);
    }
}
