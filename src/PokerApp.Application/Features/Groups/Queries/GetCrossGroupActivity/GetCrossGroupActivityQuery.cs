using MediatR;

namespace PokerApp.Application.Features.Groups.Queries.GetCrossGroupActivity;

public sealed record GetCrossGroupActivityQuery(
    int Skip = 0,
    int Take = GetCrossGroupActivityQuery.DefaultTake) : IRequest<List<CrossGroupActivityDto>>
{
    public const int DefaultTake = 10;
    public const int MaxTake = 50;
}

public sealed record CrossGroupActivityDto(
    Guid Id,
    Guid GroupId,
    string GroupName,
    string ActorName,
    string Type,
    string Description,
    DateTime CreatedAt,
    Guid? RelatedSessionId);
