using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Commands.InviteUser;

public sealed class InviteUserToGroupCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    INotificationService notificationService) : IRequestHandler<InviteUserToGroupCommand, InviteUserToGroupResponse>
{
    public async Task<InviteUserToGroupResponse> Handle(InviteUserToGroupCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var group = await context.Groups
            .FirstOrDefaultAsync(g => g.Id == request.GroupId, cancellationToken)
            ?? throw new NotFoundException(nameof(Group), request.GroupId);

        var callerMembership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == request.GroupId && m.UserId == callerId, cancellationToken)
            ?? throw new UnauthorizedException("You are not a member of this group.");

        if (callerMembership.Role == GroupRole.Member)
            throw new UnauthorizedException("Only admins and owners can invite users.");

        var invitedUser = await context.Users
            .FirstOrDefaultAsync(u => u.Username == request.Username, cancellationToken)
            ?? throw new NotFoundException(nameof(User), request.Username);

        if (await context.GroupMembers.AnyAsync(
                m => m.GroupId == request.GroupId && m.UserId == invitedUser.Id, cancellationToken))
            throw new ConflictException($"{request.Username} is already a member of this group.");

        if (await context.GroupInvitations.AnyAsync(
                i => i.GroupId == request.GroupId
                  && i.InvitedUserId == invitedUser.Id
                  && i.Status == InvitationStatus.Pending, cancellationToken))
            throw new ConflictException($"{request.Username} already has a pending invitation to this group.");

        var expiresAt = DateTime.UtcNow.AddDays(7);
        var invitation = GroupInvitation.Create(request.GroupId, callerId, invitedUser.Id, expiresAt);

        await context.GroupInvitations.AddAsync(invitation, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        try
        {
            var senderName = currentUserService.Username ?? "Someone";
            await notificationService.NotifyAsync(
                invitedUser.Id,
                NotificationType.GroupInviteReceived,
                "Group Invitation",
                $"{senderName} invited you to join \"{group.Name}\"",
                invitation.Id,
                cancellationToken);
        }
        catch { /* notifications are non-critical */ }

        return new InviteUserToGroupResponse(invitation.Id, group.Name, invitedUser.Username);
    }
}
