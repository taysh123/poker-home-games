using MediatR;

namespace PokerApp.Application.Features.Groups.Commands.CreateGroup;

public sealed record CreateGroupCommand(string Name, string? Description) : IRequest<CreateGroupResponse>;

public sealed record CreateGroupResponse(Guid Id, string Name, string? Description, Guid OwnerId, DateTime CreatedAt);
