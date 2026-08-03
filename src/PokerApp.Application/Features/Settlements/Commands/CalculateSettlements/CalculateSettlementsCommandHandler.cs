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
        // An account deletion anonymises its SessionPlayer rows (UserId, LinkedUserId and
        // GuestName all null — a row DeleteAccountCommandHandler leaves behind deliberately, so
        // the session's participant list and everyone else's totals still reconcile).
        //
        // Such a player has no SettlementUserId, so the split below drops them from the balance
        // pool. The remaining balances then no longer sum to zero, and SettlementCalculator walks
        // debtors/creditors with `while (d < debtors.Count && c < creditors.Count)`, silently
        // discarding whatever is left over when one list empties. Line ~83 would then DELETE the
        // surviving pending settlements and replace them with that wrong set.
        //
        // This is not opt-in: SessionScreen auto-calls this command whenever a finished session
        // has zero saved settlements — exactly the state account deletion leaves behind — so the
        // counterparty's receivable would be destroyed with no user action, the next time they
        // opened the session. Refusing keeps the settlements that were correct when they were
        // computed, which is the only outcome that does not lose someone else's money.
        //
        // DEFERRED ALTERNATIVE (owner decision, 2026-08-03): preserve the departed party properly
        // by making Settlement.PayerUserId/ReceiverUserId nullable and anonymising instead of
        // deleting. That is richer but needs a migration plus a DTO change reaching the mobile
        // client; this guard is the smaller change that removes the data loss now.
        var hasDeletedPlayer = allPlayers.Any(sp =>
            sp.UserId is null && sp.LinkedUserId is null && sp.GuestName is null);
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
