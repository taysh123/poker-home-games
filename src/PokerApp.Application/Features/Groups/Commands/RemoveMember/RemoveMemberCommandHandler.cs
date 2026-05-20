using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Commands.RemoveMember;

public sealed class RemoveMemberCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<RemoveMemberCommand>
{
    public async Task Handle(RemoveMemberCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var callerMembership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == request.GroupId && m.UserId == callerId, cancellationToken)
            ?? throw new UnauthorizedException("You are not a member of this group.");

        if (callerMembership.Role == GroupRole.Member)
            throw new UnauthorizedException("Only admins and owners can remove members.");

        if (request.UserId == callerId)
            throw new ConflictException("Use the leave endpoint to leave a group.");

        var targetMembership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == request.GroupId && m.UserId == request.UserId, cancellationToken)
            ?? throw new NotFoundException(nameof(GroupMember), request.UserId);

        // Admins cannot remove other admins or the owner — only the owner can
        if (callerMembership.Role == GroupRole.Admin && targetMembership.Role >= GroupRole.Admin)
            throw new UnauthorizedException("Admins cannot remove other admins or the owner.");

        if (targetMembership.Role == GroupRole.Owner)
            throw new ConflictException("The group owner cannot be removed.");

        context.GroupMembers.Remove(targetMembership);

        var actorName = currentUserService.Username ?? "Unknown";
        var targetUser = await context.Users
            .Where(u => u.Id == request.UserId)
            .Select(u => u.Username)
            .FirstOrDefaultAsync(cancellationToken) ?? "Unknown";
        await context.ActivityLogs.AddAsync(
            ActivityLog.Create(request.GroupId, callerId, actorName, ActivityType.MemberRemoved,
                $"{actorName} removed {targetUser} from the group"),
            cancellationToken);

        await context.SaveChangesAsync(cancellationToken);
    }
}
