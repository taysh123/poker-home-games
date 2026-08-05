using MediatR;

namespace PokerApp.Application.Features.Sessions.Queries.GetSessionHandHistory;

public sealed record GetSessionHandHistoryQuery(Guid SessionId) : IRequest<IReadOnlyList<HandRecordDto>>;

/// <summary>
/// <paramref name="IsMine"/> replaces what used to be the raw <c>CreatedByUserId</c> GUID (audit
/// 2026-08-03, HIGH #4): the account id of whoever logged the hand was serialised to every session
/// participant, and — having no modelled FK — was never cleared when that account was deleted.
/// The client's only use for it was comparing it to the signed-in user's id to decide whether to
/// draw the delete button, so the endpoint now returns that ANSWER instead of the identifier.
/// Computed from the same rule DeleteHandRecordCommandHandler enforces, so the two cannot drift.
/// </summary>
public sealed record HandRecordDto(Guid Id, string WinnerName, decimal PotAmount, string? Note, bool IsMine, DateTime CreatedAt);
