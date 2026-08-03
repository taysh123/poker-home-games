using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Settlements.Commands.CalculateSettlements;

public sealed class CalculateSettlementsCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    ISettlementCalculator calculator) : IRequestHandler<CalculateSettlementsCommand, CalculateSettlementsResult>
{
    public async Task<CalculateSettlementsResult> Handle(CalculateSettlementsCommand request, CancellationToken cancellationToken)
    {
        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        if (session.Status != SessionStatus.Finished)
            throw new BadRequestException("Settlements can only be calculated for finished sessions.");

        var callerId = currentUserService.UserId;

        if (session.GroupId.HasValue)
        {
            var isMember = await context.GroupMembers
                .AnyAsync(m => m.GroupId == session.GroupId.Value && m.UserId == callerId, cancellationToken);
            if (!isMember)
                throw new UnauthorizedException("You are not a member of this group.");
        }
        else if (session.CreatorId != callerId)
        {
            throw new UnauthorizedException("Only the session creator can calculate settlements.");
        }

        var allPlayers = await context.SessionPlayers
            .Where(sp => sp.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        var allBuyIns = await context.BuyIns
            .Where(b => b.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        var allCashOuts = await context.CashOuts
            .Where(c => c.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        // ── Refuse to recalculate a session containing a DELETED player ──────────────────────
        //
        // Account deletion leaves TWO SessionPlayer shapes behind, both deliberate — the rows
        // survive so the session's participant list and everyone else's totals still reconcile:
        //   · the leaver's OWN row, anonymised (UserId null; GuestName was always null);
        //   · a GUEST row that was LINKED to the leaver, unlinked (LinkedUserId null) with
        //     GuestName KEPT — by shape now identical to an ordinary walk-in guest.
        // Both are stamped with AccountDeletedAt at deletion time; for the guest shape that stamp
        // is the ONLY signal, because no predicate over the surviving columns can distinguish it
        // from a guest who never had an account. The all-null clause below is kept for rows
        // anonymised by builds that predate the marker. HONEST LIMIT: a pre-marker LINKED-GUEST
        // row is indistinguishable from a plain guest and is NOT caught.
        //
        // Either shape has no SettlementUserId, so the split below moves it out of the digital
        // pool and into the cash-balance projection, like a walk-in guest. That is honest when
        // computing a FIRST set — but recalculating over a RECORDED set matches the remaining
        // debtors/creditors differently than when the departed player was still in the pool, so
        // survivors' receivables get reassigned or dropped, and the RemoveRange of pending
        // settlements below destroys the set that was correct when it was computed.
        //
        // The guard is SCOPED to sessions that already have settlement rows (owner decision,
        // 2026-08-04): refusing is only right when there is something recorded to protect.
        // An unconditional refusal made a session whose player deleted MID-GAME (before any
        // settlements existed) permanently unsettleable — this handler is the only producer of
        // Settlement rows, so the whole table lost in-app settlement forever. With no rows
        // recorded, the FIRST calculation runs instead: the departed player is carved out as a
        // cash balance exactly like an ordinary walk-in guest (see the cash-balance projection
        // below), so the survivors' transfers are computed on honest numbers and nothing is
        // silently dropped. Scoping also makes the refusal message's closing sentence
        // ("The settlements already recorded are unchanged.") true every time it is sent.
        //
        // How the destroyed-settlements harm is REACHED (corrected after review — an earlier
        // version claimed the auto-call destroys a surviving receivable "with no user action, on
        // next open", but the two halves are mutually exclusive: SessionScreen only auto-calls
        // when the saved-settlements list came back EMPTY): with recorded settlements present,
        // recalculation is reachable via the manual Recalculate control, or via the auto-call
        // after a failed settlements GET. Both are refused here.
        //
        // DEFERRED ALTERNATIVE (owner decision, 2026-08-03): preserve the departed party properly
        // by making Settlement.PayerUserId/ReceiverUserId nullable and anonymising instead of
        // deleting. That is richer but needs a migration plus a DTO change reaching the mobile
        // client; this guard is the smaller change that removes the data loss now.
        var hasDeletedPlayer = allPlayers.Any(sp =>
            sp.AccountDeletedAt is not null
            || (sp.UserId is null && sp.LinkedUserId is null && sp.GuestName is null));
        var hasRecordedSettlements = await context.Settlements
            .AnyAsync(s => s.SessionId == request.SessionId, cancellationToken);
        if (hasDeletedPlayer && hasRecordedSettlements)
            throw new BadRequestException(
                "This session includes a player whose account was deleted, so settlements can no longer be recalculated. The settlements already recorded are unchanged.");

        // Orphaned money: a legacy row (attributed only by UserId) whose account was deleted and
        // could not be re-keyed to a seat (DeleteAccountCommandHandler backfills when the leaver
        // has a seat; this shape means they did not). The amount belongs to no balance
        // projection, so ANY computed set would silently ignore real money — refuse regardless
        // of whether settlements are recorded. This fires only for deletion residue: every
        // factory sets SessionPlayerId, so a (null, null) money row has no other origin.
        var hasOrphanedMoney =
            allBuyIns.Any(b => b.SessionPlayerId == null && b.UserId == null)
            || allCashOuts.Any(c => c.SessionPlayerId == null && c.UserId == null);
        if (hasOrphanedMoney)
            throw new BadRequestException(
                "Money in this session can no longer be attributed to a player because an account was deleted, so settlements can't be calculated.");

        // Split: players with a SettlementUserId participate in formal (digital) settlements;
        // unlinked guests have no SettlementUserId and are handled manually outside the app.
        var linkedPlayers = allPlayers.Where(sp => sp.SettlementUserId.HasValue).ToList();
        var unlinkedGuests = allPlayers.Where(sp => !sp.SettlementUserId.HasValue).ToList();

        // Group by SettlementUserId so linked guests aggregate into the linked user's balance
        var balancesBySettlementUser = linkedPlayers
            .GroupBy(sp => sp.SettlementUserId!.Value)
            .Select(group =>
            {
                var totalBuyIn = allBuyIns
                    .Where(b => group.Any(sp => b.SessionPlayerId == sp.Id || (b.SessionPlayerId == null && b.UserId == sp.UserId)))
                    .Sum(b => b.Amount);
                var totalCashOut = allCashOuts
                    .Where(c => group.Any(sp => c.SessionPlayerId == sp.Id || (c.SessionPlayerId == null && c.UserId == sp.UserId)))
                    .Sum(c => c.Amount);
                return new PlayerNetBalance(group.Key, totalCashOut - totalBuyIn);
            }).ToList();

        var instructions = calculator.Calculate(balancesBySettlementUser).ToList();

        var allLinkedPlayerIds = linkedPlayers.Select(sp => sp.SettlementUserId!.Value).ToHashSet();

        // Load usernames for DTO population
        var users = await context.Users
            .Where(u => allLinkedPlayerIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Username })
            .ToDictionaryAsync(u => u.Id, u => u.Username, cancellationToken);

        // Idempotent: replace any existing pending settlements for this session
        var existing = await context.Settlements
            .Where(s => s.SessionId == request.SessionId && s.Status == SettlementStatus.Pending)
            .ToListAsync(cancellationToken);
        context.Settlements.RemoveRange(existing);

        var newSettlements = instructions
            .Select(i => Settlement.Create(request.SessionId, i.PayerUserId, i.ReceiverUserId, i.Amount))
            .ToList();

        await context.Settlements.AddRangeAsync(newSettlements, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        var settlementDtos = newSettlements.Select(s => new SettlementDto(
            s.Id,
            s.PayerUserId,
            users.GetValueOrDefault(s.PayerUserId, "Unknown"),
            s.ReceiverUserId,
            users.GetValueOrDefault(s.ReceiverUserId, "Unknown"),
            s.Amount,
            s.Status.ToString()
        )).ToList();

        // Compute net balance for each unlinked guest — callers must settle these in cash.
        // A DELETED player's anonymised row also lands here (no SettlementUserId) and has no
        // GuestName; it gets an honest placeholder rather than shipping null through a non-null
        // DTO field. A departed LINKED guest keeps its real name — the host's record of who sat
        // at the table.
        var guestBalanceDtos = unlinkedGuests
            .Select(sp =>
            {
                var totalBuyIn = allBuyIns.Where(b => b.SessionPlayerId == sp.Id).Sum(b => b.Amount);
                var totalCashOut = allCashOuts.Where(c => c.SessionPlayerId == sp.Id).Sum(c => c.Amount);
                return new GuestBalanceDto(sp.Id, sp.GuestName ?? "Departed player", totalCashOut - totalBuyIn);
            })
            .Where(g => g.NetBalance != 0)
            .ToList();

        return new CalculateSettlementsResult(settlementDtos, guestBalanceDtos);
    }
}
