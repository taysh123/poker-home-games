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
/// <param name="CreatedByUserId">
/// TRANSITIONAL — REMOVE ONCE THE 1.1.1 INSTALL BASE HAS TURNED OVER. Builds shipped before
/// <paramref name="IsMine"/> existed drew the delete-hand button from
/// <c>createdByUserId === user.userId</c>; with the field absent that comparison is permanently
/// false and the affordance silently disappears until the user updates. So the field stays for one
/// release — but it is populated ONLY with the CALLER'S OWN id (and <c>Guid.Empty</c> for anyone
/// else's hand), which discloses nothing: the caller already knows their own id. It must never
/// again carry another user's identifier — pinned by
/// HandHistoryPrivacyTests.The_transitional_creator_id_is_only_ever_the_callers_own.
/// Removal is tracked in the Tier 0 plan's follow-up list.
/// </param>
public sealed record HandRecordDto(Guid Id, string WinnerName, decimal PotAmount, string? Note, bool IsMine, Guid CreatedByUserId, DateTime CreatedAt);
