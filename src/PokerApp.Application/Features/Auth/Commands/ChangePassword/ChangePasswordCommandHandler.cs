using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Auth.Commands.ChangePassword;

public sealed class ChangePasswordCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUser,
    IPasswordHasher passwordHasher) : IRequestHandler<ChangePasswordCommand, Unit>
{
    public async Task<Unit> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUser.UserId, cancellationToken)
            ?? throw new NotFoundException("User", currentUser.UserId);

        if (user.PasswordHash == string.Empty)
            throw new BadRequestException("Password change is not available for Google-only accounts.");

        if (!passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
            throw new UnauthorizedException("Current password is incorrect.");

        user.UpdatePassword(passwordHasher.Hash(request.NewPassword));

        // A password change must invalidate every existing session — otherwise a
        // compromised account stays reachable via its old refresh tokens for up to
        // 30 days. Revoke all active tokens so other devices are forced to re-login.
        var activeTokens = await context.RefreshTokens
            .Where(rt => rt.UserId == user.Id && !rt.IsRevoked)
            .ToListAsync(cancellationToken);
        foreach (var token in activeTokens)
            token.Revoke();

        await context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
