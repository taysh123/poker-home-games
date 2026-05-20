using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Commands.DeleteGroup;

public sealed class DeleteGroupCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<DeleteGroupCommand>
{
    public async Task Handle(DeleteGroupCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var group = await context.Groups
            .FirstOrDefaultAsync(g => g.Id == request.GroupId, cancellationToken)
            ?? throw new NotFoundException(nameof(Group), request.GroupId);

        var membership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == request.GroupId && m.UserId == userId, cancellationToken)
            ?? throw new UnauthorizedException("You are not a member of this group.");

        if (membership.Role != GroupRole.Owner)
            throw new UnauthorizedException("Only the group owner can delete the group.");

        context.Groups.Remove(group);
        await context.SaveChangesAsync(cancellationToken);
    }
}
