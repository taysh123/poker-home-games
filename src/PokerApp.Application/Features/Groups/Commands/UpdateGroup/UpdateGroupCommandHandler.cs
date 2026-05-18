using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Commands.UpdateGroup;

public sealed class UpdateGroupCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateGroupCommand, UpdateGroupResponse>
{
    public async Task<UpdateGroupResponse> Handle(UpdateGroupCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var group = await context.Groups
            .FirstOrDefaultAsync(g => g.Id == request.GroupId, cancellationToken)
            ?? throw new NotFoundException(nameof(Group), request.GroupId);

        var callerMembership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == request.GroupId && m.UserId == callerId, cancellationToken)
            ?? throw new UnauthorizedException("You are not a member of this group.");

        if (callerMembership.Role == GroupRole.Member)
            throw new UnauthorizedException("Only admins and owners can update group details.");

        group.Update(request.Name, request.Description);
        await context.SaveChangesAsync(cancellationToken);

        return new UpdateGroupResponse(group.Id, group.Name, group.Description);
    }
}
