using MediatR;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupActivity;

public sealed record GetGroupActivityQuery(
    Guid GroupId,
    int Skip = 0,
    int Take = GetGroupActivityQuery.DefaultTake) : IRequest<List<ActivityLogDto>>
{
    public const int DefaultTake = 50;
    public const int MaxTake = 50;
}

public sealed record ActivityLogDto(
    Guid Id,
    string ActorName,
    string Type,
    string Description,
    DateTime CreatedAt,
    Guid? RelatedSessionId);
