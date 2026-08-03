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

        // ── Every RESTRICT foreign key pointing at Users must be cleared before the delete ──
        //
        // Cascading FKs (memberships, received invitations, refresh tokens, device tokens,
        // notifications, achievements, cloud backups, subscriptions/credits) are handled by the
        // database. RESTRICT ones are not: each BLOCKS the delete until it is cleared here, and a
        // missed one surfaces as a DbUpdateException that ExceptionHandlingMiddleware does not map
        // — i.e. a bare 500 and "Failed to delete account." on a shipped build that Apple requires
        // to offer working deletion (Review Guideline 5.1.1(v)).
        //
        // The list below is derived from the EF model snapshot, NOT from memory. If a migration
        // adds another RESTRICT FK to Users without updating this handler,
        // DeleteAccountFkIntegrityTests fails on the constraint — that test runs on SQLite
        // precisely because the InMemory provider enforces no referential integrity and would
        // pass regardless.

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
        foreach (var sp in sessionPlayers)
        {
            if (sp.UserId == userId) sp.AnonymizeUser();
            if (sp.LinkedUserId == userId) sp.UnlinkUser();
        }

        // Legacy money rows can carry a direct UserId (RESTRICT). Amounts and SessionPlayer links
        // are kept so the session still balances for everyone else at that table.
        var buyIns = await context.BuyIns
            .Where(b => b.UserId == userId).ToListAsync(cancellationToken);
        foreach (var b in buyIns) b.AnonymizeUser();

        var cashOuts = await context.CashOuts
            .Where(c => c.UserId == userId).ToListAsync(cancellationToken);
        foreach (var c in cashOuts) c.AnonymizeUser();

        // Settlements name BOTH parties with required RESTRICT FKs, so they cannot be anonymized
        // without a schema change (nullable columns + a DTO/API change reaching the mobile client).
        // They are removed instead: a settlement is DERIVED data — regenerable from the buy-ins and
        // cash-outs above via "Recalculate settlements" — and it is the row that most directly
        // names the departing user, which erasure should remove.
        //
        // TRADE-OFF, stated rather than buried: the counterparty loses this row's paid/pending
        // status for debts involving the deleted user. Preserving it instead would mean making
        // PayerUserId/ReceiverUserId nullable — a migration plus a cross-boundary DTO change — and
        // is the owner's call, not one to make silently inside a compliance hotfix.
        var settlements = await context.Settlements
            .Where(s => s.PayerUserId == userId || s.ReceiverUserId == userId)
            .ToListAsync(cancellationToken);
        context.Settlements.RemoveRange(settlements);

        context.Users.Remove(user);
        await context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
