using MediatR;

namespace PokerApp.Application.Features.Groups.Commands.InviteUser;

public sealed record InviteUserToGroupCommand(Guid GroupId, string Username) : IRequest<InviteUserToGroupResponse>;

public sealed record InviteUserToGroupResponse(Guid InvitationId, string GroupName, string InvitedUsername);
