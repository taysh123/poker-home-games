using MediatR;

namespace PokerApp.Application.Features.Groups.Commands.UpdateGroup;

public sealed record UpdateGroupCommand(Guid GroupId, string Name, string? Description) : IRequest<UpdateGroupResponse>;

public sealed record UpdateGroupResponse(Guid Id, string Name, string? Description);
