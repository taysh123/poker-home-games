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

        // Remove group memberships, invitations, and refresh tokens
        var memberships = await context.GroupMembers
            .Where(m => m.UserId == userId).ToListAsync(cancellationToken);
        context.GroupMembers.RemoveRange(memberships);

        var invitations = await context.GroupInvitations
            .Where(i => i.InvitedUserId == userId).ToListAsync(cancellationToken);
        context.GroupInvitations.RemoveRange(invitations);

        var refreshTokens = await context.RefreshTokens
            .Where(t => t.UserId == userId).ToListAsync(cancellationToken);
        context.RefreshTokens.RemoveRange(refreshTokens);

        // Anonymize historical session participation (null out the userId FK)
        var sessionPlayers = await context.SessionPlayers
            .Where(sp => sp.UserId == userId).ToListAsync(cancellationToken);
        foreach (var sp in sessionPlayers)
            sp.AnonymizeUser();

        context.Users.Remove(user);
        await context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
