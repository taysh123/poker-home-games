using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Auth.Commands.UpdateProfile;

public sealed class UpdateProfileCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUser) : IRequestHandler<UpdateProfileCommand, UpdateProfileResponse>
{
    public async Task<UpdateProfileResponse> Handle(
        UpdateProfileCommand request,
        CancellationToken cancellationToken)
    {
        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUser.UserId, cancellationToken)
            ?? throw new NotFoundException("User", currentUser.UserId);

        if (request.Username is not null && request.Username != user.Username)
        {
            if (await context.Users.AnyAsync(u => u.Username == request.Username, cancellationToken))
                throw new ConflictException("Username is already taken.");
            user.UpdateUsername(request.Username);
        }

        if (request.Email is not null && request.Email != user.Email)
        {
            if (await context.Users.AnyAsync(u => u.Email == request.Email, cancellationToken))
                throw new ConflictException("Email is already in use.");
            user.UpdateEmail(request.Email);
        }

        // null = no change; empty string = clear the avatar field
        if (request.AvatarEmoji is not null)
            user.UpdateAvatarEmoji(request.AvatarEmoji.Length == 0 ? null : request.AvatarEmoji);

        if (request.AvatarColor is not null)
            user.UpdateAvatarColor(request.AvatarColor.Length == 0 ? null : request.AvatarColor);

        await context.SaveChangesAsync(cancellationToken);

        return new UpdateProfileResponse(user.Id, user.Username, user.Email, user.AvatarEmoji, user.AvatarColor);
    }
}
