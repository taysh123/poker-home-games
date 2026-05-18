using MediatR;

namespace PokerApp.Application.Features.Groups.Commands.AcceptInvitation;

public sealed record AcceptInvitationCommand(Guid InvitationId) : IRequest<AcceptInvitationResponse>;

public sealed record AcceptInvitationResponse(Guid GroupId, string GroupName, string Role);
