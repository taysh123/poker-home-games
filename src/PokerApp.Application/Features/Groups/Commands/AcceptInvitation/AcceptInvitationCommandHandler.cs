using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Commands.AcceptInvitation;

public sealed class AcceptInvitationCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<AcceptInvitationCommand, AcceptInvitationResponse>
{
    public async Task<AcceptInvitationResponse> Handle(AcceptInvitationCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var invitation = await context.GroupInvitations
            .Include(i => i.Group)
            .FirstOrDefaultAsync(i => i.Id == request.InvitationId, cancellationToken)
            ?? throw new NotFoundException(nameof(GroupInvitation), request.InvitationId);

        if (invitation.InvitedUserId != callerId)
            throw new UnauthorizedException("This invitation was not sent to you.");

        if (!invitation.IsActive)
            throw new ConflictException("This invitation is no longer active.");

        if (await context.GroupMembers.AnyAsync(
                m => m.GroupId == invitation.GroupId && m.UserId == callerId, cancellationToken))
            throw new ConflictException("You are already a member of this group.");

        invitation.Accept();
        var membership = GroupMember.Create(invitation.GroupId, callerId, GroupRole.Member);

        await context.GroupMembers.AddAsync(membership, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new AcceptInvitationResponse(invitation.GroupId, invitation.Group.Name, nameof(GroupRole.Member));
    }
}
