using MediatR;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupById;

public sealed record GetGroupByIdQuery(Guid GroupId) : IRequest<GetGroupByIdResponse>;

public sealed record GetGroupByIdResponse(
    Guid Id,
    string Name,
    string? Description,
    Guid OwnerId,
    string OwnerUsername,
    int MemberCount,
    DateTime CreatedAt,
    int TotalSessions = 0,
    decimal TotalMoneyMoved = 0);
