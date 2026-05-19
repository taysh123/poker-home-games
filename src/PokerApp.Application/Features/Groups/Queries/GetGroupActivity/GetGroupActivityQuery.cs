using MediatR;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupActivity;

public sealed record GetGroupActivityQuery(Guid GroupId) : IRequest<List<ActivityLogDto>>;

public sealed record ActivityLogDto(
    Guid Id,
    string ActorName,
    string Type,
    string Description,
    DateTime CreatedAt);
