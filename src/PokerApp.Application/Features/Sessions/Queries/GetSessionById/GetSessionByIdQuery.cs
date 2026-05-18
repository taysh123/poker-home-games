using MediatR;

namespace PokerApp.Application.Features.Sessions.Queries.GetSessionById;

public sealed record GetSessionByIdQuery(Guid SessionId) : IRequest<SessionDetailDto>;

public sealed record SessionDetailDto(
    Guid Id,
    string Name,
    Guid GroupId,
    string Status,
    decimal SmallBlind,
    decimal BigBlind,
    decimal? ChipRatio,
    decimal? DefaultBuyIn,
    IReadOnlyList<SessionPlayerDto> Players,
    DateTime? StartedAt,
    DateTime? EndedAt,
    DateTime CreatedAt);

public sealed record SessionPlayerDto(Guid UserId, string Username);
