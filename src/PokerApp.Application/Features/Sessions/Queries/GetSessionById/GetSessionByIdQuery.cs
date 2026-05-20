using MediatR;

namespace PokerApp.Application.Features.Sessions.Queries.GetSessionById;

public sealed record GetSessionByIdQuery(Guid SessionId) : IRequest<SessionDetailDto>;

public sealed record SessionDetailDto(
    Guid Id,
    string Name,
    Guid? GroupId,
    string? GroupName,
    Guid CreatorId,
    string Status,
    decimal? ChipRatio,
    decimal? DefaultBuyIn,
    IReadOnlyList<SessionPlayerDto> Players,
    DateTime? StartedAt,
    DateTime? EndedAt,
    DateTime CreatedAt,
    string? Notes);

public sealed record SessionPlayerDto(Guid SessionPlayerId, Guid? UserId, string Username, bool IsGuest, Guid? LinkedUserId);
