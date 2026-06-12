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

        // Deliberately vague error — never reveal whether the email exists
        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
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
