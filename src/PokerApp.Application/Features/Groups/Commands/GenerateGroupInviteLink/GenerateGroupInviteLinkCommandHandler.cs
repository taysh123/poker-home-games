using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Commands.GenerateGroupInviteLink;

public sealed class GenerateGroupInviteLinkCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IWebSettings webSettings) : IRequestHandler<GenerateGroupInviteLinkCommand, GenerateGroupInviteLinkResponse>
{
    public async Task<GenerateGroupInviteLinkResponse> Handle(
        GenerateGroupInviteLinkCommand request,
        CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var group = await context.Groups
            .FirstOrDefaultAsync(g => g.Id == request.GroupId, cancellationToken)
            ?? throw new NotFoundException(nameof(Group), request.GroupId);

        var callerMembership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == request.GroupId && m.UserId == callerId, cancellationToken)
            ?? throw new UnauthorizedException("You are not a member of this group.");

        if (callerMembership.Role == GroupRole.Member)
            throw new UnauthorizedException("Only admins and owners can generate invite links.");

        // Revoke any existing active links for this group
        var existingLinks = await context.GroupInviteLinks
            .Where(l => l.GroupId == request.GroupId && !l.IsRevoked)
            .ToListAsync(cancellationToken);

        foreach (var existing in existingLinks)
            existing.Revoke();

        var link = GroupInviteLink.Create(request.GroupId, callerId);
        await context.GroupInviteLinks.AddAsync(link, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        var baseUrl = string.IsNullOrEmpty(webSettings.WebBaseUrl)
            ? "tpoker://group"
            : $"{webSettings.WebBaseUrl}/join/group";

        return new GenerateGroupInviteLinkResponse(
            link.Token,
            $"{baseUrl}/{link.Token}",
            link.ExpiresAt);
    }
}
