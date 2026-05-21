using MediatR;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupRivals;

public sealed record GetGroupRivalsQuery(Guid GroupId) : IRequest<List<GroupRivalryDto>>;

public sealed record GroupRivalryDto(
    Guid Player1Id,
    string Player1Username,
    decimal Player1NetPL,
    Guid Player2Id,
    string Player2Username,
    decimal Player2NetPL,
    int SessionsTogether
);
