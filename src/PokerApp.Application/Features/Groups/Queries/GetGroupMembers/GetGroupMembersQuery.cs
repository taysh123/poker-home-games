using MediatR;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupMembers;

public sealed record GetGroupMembersQuery(Guid GroupId) : IRequest<IReadOnlyList<GroupMemberDto>>;

public sealed record GroupMemberDto(Guid UserId, string Username, string Role, DateTime JoinedAt);
