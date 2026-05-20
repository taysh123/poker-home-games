using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Commands.JoinGroupByInviteLink;

public sealed class JoinGroupByInviteLinkCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<JoinGroupByInviteLinkCommand, JoinGroupByInviteLinkResponse>
{
    public async Task<JoinGroupByInviteLinkResponse> Handle(
        JoinGroupByInviteLinkCommand request,
        CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var link = await context.GroupInviteLinks
            .Include(l => l.Group)
            .FirstOrDefaultAsync(l => l.Token == request.InviteToken, cancellationToken)
            ?? throw new NotFoundException(nameof(GroupInviteLink), request.InviteToken);

        if (!link.IsActive)
            throw new BadRequestException("This invite link has expired or been revoked.");

        var callerUser = await context.Users
            .FirstOrDefaultAsync(u => u.Id == callerId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), callerId);

        // Idempotent: if already a member, just return current info
        var existingMembership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == link.GroupId && m.UserId == callerId, cancellationToken);

        if (existingMembership is not null)
        {
            return new JoinGroupByInviteLinkResponse(
                link.GroupId,
                link.Group.Name,
                existingMembership.Role.ToString());
        }

        var member = GroupMember.Create(link.GroupId, callerId, GroupRole.Member);
        await context.GroupMembers.AddAsync(member, cancellationToken);

        var activity = ActivityLog.Create(
            link.GroupId,
            callerId,
            callerUser.Username,
            ActivityType.MemberJoined,
            $"{callerUser.Username} joined via invite link");
        await context.ActivityLogs.AddAsync(activity, cancellationToken);

        await context.SaveChangesAsync(cancellationToken);

        return new JoinGroupByInviteLinkResponse(
            link.GroupId,
            link.Group.Name,
            GroupRole.Member.ToString());
    }
}
