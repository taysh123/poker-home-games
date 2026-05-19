using MediatR;

namespace PokerApp.Application.Features.Sessions.Queries.GetSessionHandHistory;

public sealed record GetSessionHandHistoryQuery(Guid SessionId) : IRequest<IReadOnlyList<HandRecordDto>>;

public sealed record HandRecordDto(Guid Id, string WinnerName, decimal PotAmount, string? Note, Guid CreatedByUserId, DateTime CreatedAt);
