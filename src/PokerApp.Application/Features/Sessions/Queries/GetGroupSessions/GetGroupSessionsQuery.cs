using MediatR;

namespace PokerApp.Application.Features.Sessions.Queries.GetGroupSessions;

public sealed record GetGroupSessionsQuery(Guid GroupId) : IRequest<IReadOnlyList<SessionSummaryDto>>;

public sealed record SessionSummaryDto(
    Guid Id,
    string Name,
    string Status,
    int PlayerCount,
    DateTime? StartedAt,
    DateTime? EndedAt,
    DateTime CreatedAt);
