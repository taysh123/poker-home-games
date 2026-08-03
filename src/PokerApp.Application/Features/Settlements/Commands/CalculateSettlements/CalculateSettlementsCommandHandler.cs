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
        // Either shape has no SettlementUserId, so the split below drops it from the balance
        // pool. The remaining balances then no longer sum to zero, and SettlementCalculator walks
        // debtors/creditors with `while (d < debtors.Count && c < creditors.Count)`, silently
        // discarding whatever is left over when one list empties — so recalculation fabricates a
        // set that reassigns or drops survivors' receivables, and the RemoveRange of pending
        // settlements below destroys whatever correct set existed.
        //
        // How that is REACHED (corrected after review — an earlier version of this comment
        // claimed the auto-call destroys a surviving receivable "with no user action, on next
        // open", but the two halves are mutually exclusive: SessionScreen only auto-calls when
        // the saved-settlements list came back EMPTY):
        //   · zero saved settlements + the auto-call ⇒ a WRONG set is fabricated with no user
        //     action (there was nothing to destroy, but survivors now owe the wrong people);
        //   · surviving settlements present ⇒ the auto-call does not fire; destruction requires
        //     the manual Recalculate control, or the auto-call after a failed settlements GET.
        // Both paths justify refusing: it keeps whatever settlements were correct when they were
        // computed, and fabricates nothing.
        //
        // DEFERRED ALTERNATIVE (owner decision, 2026-08-03): preserve the departed party properly
        // by making Settlement.PayerUserId/ReceiverUserId nullable and anonymising instead of
        // deleting. That is richer but needs a migration plus a DTO change reaching the mobile
        // client; this guard is the smaller change that removes the data loss now.
        var hasDeletedPlayer = allPlayers.Any(sp =>
            sp.AccountDeletedAt is not null
            || (sp.UserId is null && sp.LinkedUserId is null && sp.GuestName is null));
        if (hasDeletedPlayer)
            throw new BadRequestException(
                "This session includes a player whose account was deleted, so settlements can no longer be recalculated. The settlements already recorded are unchanged.");

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

        // Compute net balance for each unlinked guest — callers must settle these in cash
        var guestBalanceDtos = unlinkedGuests
            .Select(sp =>
            {
                var totalBuyIn = allBuyIns.Where(b => b.SessionPlayerId == sp.Id).Sum(b => b.Amount);
                var totalCashOut = allCashOuts.Where(c => c.SessionPlayerId == sp.Id).Sum(c => c.Amount);
                return new GuestBalanceDto(sp.Id, sp.GuestName!, totalCashOut - totalBuyIn);
            })
            .Where(g => g.NetBalance != 0)
            .ToList();

        return new CalculateSettlementsResult(settlementDtos, guestBalanceDtos);
    }
}
