using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Auth.Queries.GetCurrentUser;

public sealed class GetCurrentUserQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetCurrentUserQuery, GetCurrentUserResponse>
{
    public async Task<GetCurrentUserResponse> Handle(
        GetCurrentUserQuery request,
        CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var user = await context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        return new GetCurrentUserResponse(
            user.Id,
            user.Username,
            user.Email,
            user.AppRole.ToString(),
            user.CreatedAt,
            user.AvatarEmoji,
            user.AvatarColor);
    }
}
