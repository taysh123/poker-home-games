using MediatR;

namespace PokerApp.Application.Features.Groups.Commands.GenerateGroupInviteLink;

public sealed record GenerateGroupInviteLinkCommand(Guid GroupId)
    : IRequest<GenerateGroupInviteLinkResponse>;

public sealed record GenerateGroupInviteLinkResponse(
    string Token,
    string DeepLinkUrl,
    DateTime ExpiresAt);
