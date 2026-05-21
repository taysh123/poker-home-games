using MediatR;

namespace PokerApp.Application.Features.Groups.Queries.GetCrossGroupActivity;

public sealed record GetCrossGroupActivityQuery : IRequest<List<CrossGroupActivityDto>>;

public sealed record CrossGroupActivityDto(
    Guid Id,
    Guid GroupId,
    string GroupName,
    string ActorName,
    string Type,
    string Description,
    DateTime CreatedAt);
