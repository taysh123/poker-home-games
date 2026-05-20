using MediatR;

namespace PokerApp.Application.Features.Groups.Commands.JoinGroupByInviteLink;

public sealed record JoinGroupByInviteLinkCommand(string InviteToken)
    : IRequest<JoinGroupByInviteLinkResponse>;

public sealed record JoinGroupByInviteLinkResponse(
    Guid GroupId,
    string GroupName,
    string Role);
