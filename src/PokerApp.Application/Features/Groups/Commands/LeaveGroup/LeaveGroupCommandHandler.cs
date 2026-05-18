using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Commands.LeaveGroup;

public sealed class LeaveGroupCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<LeaveGroupCommand>
{
    public async Task Handle(LeaveGroupCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var membership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == request.GroupId && m.UserId == callerId, cancellationToken)
            ?? throw new NotFoundException(nameof(GroupMember), callerId);

        // The owner holds an FK with Restrict behavior — we block this early to give a clear error
        if (membership.Role == GroupRole.Owner)
            throw new ConflictException("The group owner cannot leave. Transfer ownership or delete the group first.");

        context.GroupMembers.Remove(membership);
        await context.SaveChangesAsync(cancellationToken);
    }
}
