using MediatR;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Commands.CreateGroup;

public sealed class CreateGroupCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CreateGroupCommand, CreateGroupResponse>
{
    public async Task<CreateGroupResponse> Handle(CreateGroupCommand request, CancellationToken cancellationToken)
    {
        var ownerId = currentUserService.UserId;

        var group = Group.Create(request.Name, request.Description, ownerId);
        var ownerMembership = GroupMember.Create(group.Id, ownerId, GroupRole.Owner);

        await context.Groups.AddAsync(group, cancellationToken);
        await context.GroupMembers.AddAsync(ownerMembership, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new CreateGroupResponse(group.Id, group.Name, group.Description, group.OwnerId, group.CreatedAt);
    }
}
