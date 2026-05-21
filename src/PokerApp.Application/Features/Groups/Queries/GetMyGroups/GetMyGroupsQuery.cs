using MediatR;

namespace PokerApp.Application.Features.Groups.Queries.GetMyGroups;

public sealed record GetMyGroupsQuery : IRequest<IReadOnlyList<MyGroupDto>>;

public sealed record MyGroupDto(
    Guid Id,
    string Name,
    string? Description,
    string Role,
    int MemberCount,
    DateTime CreatedAt,
    decimal? MyGroupPL,
    int MyGroupSessions);
