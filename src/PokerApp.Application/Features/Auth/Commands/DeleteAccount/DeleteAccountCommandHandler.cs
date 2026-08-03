using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Auth.Commands.DeleteAccount;

public sealed class DeleteAccountCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUser) : IRequestHandler<DeleteAccountCommand, Unit>
{
    public async Task<Unit> Handle(DeleteAccountCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;

        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User", userId);

        // Block if the user owns any groups — they must leave or transfer ownership first
        var ownsGroup = await context.GroupMembers
            .AnyAsync(m => m.UserId == userId && m.Role == GroupRole.Owner, cancellationToken);
        if (ownsGroup)
            throw new BadRequestException(
                "You own one or more groups. Transfer ownership or delete the groups before deleting your account.");

        // ── Every RESTRICT foreign key pointing at Users must be cleared HERE or blocked UPSTREAM ──
        //
        // Cascading FKs (memberships, received invitations, refresh tokens, device tokens,
        // device bindings, notifications, achievements, cloud backups, subscriptions/credits —
        // the 11 Cascade entries in the pinned inventory) are handled by the database. RESTRICT ones are not: each BLOCKS the delete until it is dealt with, and a
        // missed one surfaces as a DbUpdateException that ExceptionHandlingMiddleware does not map
        // — i.e. a bare 500 carrying only a trace id, on a shipped build that Apple requires to
        // offer working deletion (Review Guideline 5.1.1(v)).
        //
        // There are EIGHT such columns. Seven are cleared below; Groups.OwnerId is the eighth and
        // is blocked upstream by the ownership precondition above — note that guard tests a
        // DIFFERENT column (GroupMembers.Role) than the constraint it protects (Groups.OwnerId),
        // an invariant three handlers maintain incidentally and nothing asserts.
        //
        // The set is pinned structurally by
        // DeleteAccountFkIntegrityTests.Foreign_keys_to_User_match_the_acknowledged_inventory_with_delete_behaviors,
        // which reads the EF MODEL and pins EVERY FK whose principal is User, delete behavior
        // included — so a migration adding a new edge fails a test even though no seeded row
        // exercises it, INCLUDING the convention-default case (a nullable UserId + navigation
        // with no explicit OnDelete gets ClientSetNull, which still blocks the delete at the
        // database). Twice corrected: an earlier version claimed the seeded tests caught new
        // edges (they cannot), and the version after that filtered the ratchet to
        // Restrict/NoAction only, which a review agent beat with exactly the ClientSetNull
        // default — reproducing this file's original 500 under a green ratchet.

        var memberships = await context.GroupMembers
            .Where(m => m.UserId == userId).ToListAsync(cancellationToken);
        context.GroupMembers.RemoveRange(memberships);

        // Invitations RECEIVED cascade, but invitations SENT hold a required RESTRICT FK
        // (InvitedByUserId). An invitation is a transient action, not a financial record, so
        // removing it loses nothing the recipient needs.
        var invitations = await context.GroupInvitations
            .Where(i => i.InvitedUserId == userId || i.InvitedByUserId == userId)
            .ToListAsync(cancellationToken);
        context.GroupInvitations.RemoveRange(invitations);

        var refreshTokens = await context.RefreshTokens
            .Where(t => t.UserId == userId).ToListAsync(cancellationToken);
        context.RefreshTokens.RemoveRange(refreshTokens);

        // Anonymize historical session participation. The ROWS SURVIVE — they are other players'
        // records of a real game — only the identity link is severed.
        var sessionPlayers = await context.SessionPlayers
            .Where(sp => sp.UserId == userId || sp.LinkedUserId == userId)
            .ToListAsync(cancellationToken);

        // The leaver's seat per session, captured BEFORE AnonymizeUser nulls the UserId that
        // identifies it. Legacy money rows below are re-keyed onto these seats.
        var ownSeatBySession = sessionPlayers
            .Where(sp => sp.UserId == userId)
            .ToDictionary(sp => sp.SessionId, sp => sp.Id);

        foreach (var sp in sessionPlayers)
        {
            if (sp.UserId == userId) sp.AnonymizeUser();
            if (sp.LinkedUserId == userId) sp.UnlinkUser();
        }

        // Legacy money rows can carry a direct UserId (RESTRICT). Amounts and SessionPlayer links
        // are kept so the session still balances for everyone else at that table. A legacy row
        // whose ONLY attribution is that UserId must first be re-keyed to the leaver's surviving
        // seat — anonymising it as-is orphans the amount from every balance projection, and the
        // departed player's cash line comes out money-wrong (fleet-demonstrated: +20 reported
        // where the truth was −80). A row that cannot be re-keyed (no seat in that session) is
        // left orphaned deliberately; CalculateSettlements refuses such sessions rather than
        // computing a set that silently ignores real money.
        var buyIns = await context.BuyIns
            .Where(b => b.UserId == userId).ToListAsync(cancellationToken);
        foreach (var b in buyIns)
        {
            if (b.SessionPlayerId is null && ownSeatBySession.TryGetValue(b.SessionId, out var seat))
                b.AttributeToSeat(seat);
            b.AnonymizeUser();
        }

        var cashOuts = await context.CashOuts
            .Where(c => c.UserId == userId).ToListAsync(cancellationToken);
        foreach (var c in cashOuts)
        {
            if (c.SessionPlayerId is null && ownSeatBySession.TryGetValue(c.SessionId, out var seat))
                c.AttributeToSeat(seat);
            c.AnonymizeUser();
        }

        // Settlements name BOTH parties with required RESTRICT FKs, so they cannot be anonymized
        // without a schema change (nullable columns + a DTO/API change reaching the mobile client).
        // They are removed instead — but read the real cost before extending this pattern.
        //
        // TRADE-OFF, corrected after review. An earlier version of this comment called settlements
        // "DERIVED data — regenerable via Recalculate settlements" and scoped the loss to a status
        // flag. BOTH were false:
        //   · Recalculation CANNOT restore them. Anonymising SessionPlayer.UserId makes
        //     SettlementUserId null, and CalculateSettlements splits players on
        //     SettlementUserId.HasValue — so the departed player leaves the balance pool entirely
        //     and their debts are simply absent from any future calculation.
        //   · The counterparty therefore loses the DEBT, not merely its paid/pending status.
        //   · Settlements store only GUIDs, never a name, so calling their removal "more
        //     erasure-correct" was backwards: this deletes the PII-free rows while the departing
        //     user's display name survives in ActivityLog.ActorName, HandRecord.WinnerName and
        //     other users' notification bodies, none of which this handler touches.
        // Preserving instead means nullable columns + a cross-boundary DTO change. That is the
        // owner's call, deliberately not made inside a compliance hotfix — see the PR.
        var settlements = await context.Settlements
            .Where(s => s.PayerUserId == userId || s.ReceiverUserId == userId)
            .ToListAsync(cancellationToken);
        context.Settlements.RemoveRange(settlements);

        context.Users.Remove(user);
        await context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
