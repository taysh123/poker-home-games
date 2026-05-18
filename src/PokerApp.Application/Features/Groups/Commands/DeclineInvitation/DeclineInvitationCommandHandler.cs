using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Groups.Commands.DeclineInvitation;

public sealed class DeclineInvitationCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<DeclineInvitationCommand>
{
    public async Task Handle(DeclineInvitationCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var invitation = await context.GroupInvitations
            .FirstOrDefaultAsync(i => i.Id == request.InvitationId, cancellationToken)
            ?? throw new NotFoundException(nameof(GroupInvitation), request.InvitationId);

        if (invitation.InvitedUserId != callerId)
            throw new UnauthorizedException("This invitation was not sent to you.");

        if (!invitation.IsActive)
            throw new ConflictException("This invitation is no longer active.");

        invitation.Decline();
        await context.SaveChangesAsync(cancellationToken);
    }
}
