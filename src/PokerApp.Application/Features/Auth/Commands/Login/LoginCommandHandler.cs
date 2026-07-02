using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using RefreshTokenEntity = PokerApp.Domain.Entities.RefreshToken;

namespace PokerApp.Application.Features.Auth.Commands.Login;

public sealed class LoginCommandHandler(
    IApplicationDbContext context,
    IPasswordHasher passwordHasher,
    IJwtService jwtService) : IRequestHandler<LoginCommand, LoginResponse>
{
    public async Task<LoginResponse> Handle(
        LoginCommand request,
        CancellationToken cancellationToken)
    {
        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email, cancellationToken);

        // Deliberately vague error — never reveal whether the email exists (or that it's a social-only account).
        // An empty PasswordHash means a Google/Apple-only account: short-circuit to the SAME 401 instead of
        // letting BCrypt.Verify throw on the empty hash (which would 500 and leak that the email is registered).
        if (user is null || string.IsNullOrEmpty(user.PasswordHash)
            || !passwordHasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedException("Invalid email or password.");

        var accessToken = jwtService.GenerateAccessToken(user);
        var (refreshTokenPlain, refreshTokenHash, refreshTokenExpiry) = jwtService.GenerateRefreshToken();
        var refreshToken = RefreshTokenEntity.Create(user.Id, refreshTokenHash, refreshTokenExpiry);

        await context.RefreshTokens.AddAsync(refreshToken, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new LoginResponse(
            user.Id, user.Username, user.Email, accessToken, refreshTokenPlain,
            user.AvatarEmoji, user.AvatarColor);
    }
}
