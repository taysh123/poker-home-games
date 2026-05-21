using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.GenerateSessionInviteToken;

public sealed class GenerateSessionInviteTokenCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IWebSettings webSettings)
    : IRequestHandler<GenerateSessionInviteTokenCommand, GenerateSessionInviteTokenResponse>
{
    public async Task<GenerateSessionInviteTokenResponse> Handle(
        GenerateSessionInviteTokenCommand request,
        CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        if (session.Status != SessionStatus.Draft && session.Status != SessionStatus.Active)
            throw new ConflictException("Invite links can only be generated for Draft or Active sessions.");

        bool isAdminOrOwner;
        if (session.GroupId.HasValue)
        {
            var role = await context.GroupMembers
                .Where(m => m.GroupId == session.GroupId.Value && m.UserId == callerId)
                .Select(m => (GroupRole?)m.Role)
                .FirstOrDefaultAsync(cancellationToken);

            if (role is null)
                throw new UnauthorizedException("You are not a member of this group.");

            isAdminOrOwner = role == GroupRole.Owner || role == GroupRole.Admin;
        }
        else
        {
            isAdminOrOwner = session.CreatorId == callerId;
        }

        if (!isAdminOrOwner)
            throw new UnauthorizedException("Only session admins can generate invite links.");

        var inviteToken = SessionInviteToken.Create(session.Id, callerId);
        await context.SessionInviteTokens.AddAsync(inviteToken, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        var baseUrl = string.IsNullOrEmpty(webSettings.WebBaseUrl)
            ? "tpoker://join/session"
            : $"{webSettings.WebBaseUrl}/join/session";

        return new GenerateSessionInviteTokenResponse(inviteToken.Token, $"{baseUrl}/{inviteToken.Token}", inviteToken.ExpiresAt);
    }
}
