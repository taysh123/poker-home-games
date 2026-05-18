using MediatR;

namespace PokerApp.Application.Features.Groups.Queries.GetMyInvitations;

public sealed record GetMyInvitationsQuery : IRequest<IReadOnlyList<PendingInvitationDto>>;

public sealed record PendingInvitationDto(
    Guid InvitationId,
    Guid GroupId,
    string GroupName,
    string InvitedByUsername,
    DateTime ExpiresAt,
    DateTime CreatedAt);
