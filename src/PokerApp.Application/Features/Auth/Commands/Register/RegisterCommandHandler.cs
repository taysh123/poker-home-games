using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using RefreshTokenEntity = PokerApp.Domain.Entities.RefreshToken;

namespace PokerApp.Application.Features.Auth.Commands.Register;

public sealed class RegisterCommandHandler(
    IApplicationDbContext context,
    IPasswordHasher passwordHasher,
    IJwtService jwtService) : IRequestHandler<RegisterCommand, RegisterResponse>
{
    public async Task<RegisterResponse> Handle(
        RegisterCommand request,
        CancellationToken cancellationToken)
    {
        // Check uniqueness before hashing — hashing is expensive (BCrypt ~250ms)
        if (await context.Users.AnyAsync(u => u.Email == request.Email, cancellationToken))
            throw new ConflictException("A user with this email already exists.");

        if (await context.Users.AnyAsync(u => u.Username == request.Username, cancellationToken))
            throw new ConflictException("A user with this username already exists.");

        var passwordHash = passwordHasher.Hash(request.Password);
        var user = User.Create(request.Username, request.Email, passwordHash);

        var accessToken = jwtService.GenerateAccessToken(user);
        var (refreshTokenPlain, refreshTokenHash, refreshTokenExpiry) = jwtService.GenerateRefreshToken();
        var refreshToken = RefreshTokenEntity.Create(user.Id, refreshTokenHash, refreshTokenExpiry);

        await context.Users.AddAsync(user, cancellationToken);
        await context.RefreshTokens.AddAsync(refreshToken, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new RegisterResponse(
            user.Id, user.Username, user.Email, accessToken, refreshTokenPlain,
            user.AvatarEmoji, user.AvatarColor);
    }
}
