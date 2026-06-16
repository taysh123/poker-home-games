using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Commands.LeaveGroup;

public sealed class LeaveGroupCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<LeaveGroupCommand>
{
    public async Task Handle(LeaveGroupCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;
        var actorName = currentUserService.Username ?? "Unknown";

        var membership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == request.GroupId && m.UserId == callerId, cancellationToken)
            ?? throw new NotFoundException(nameof(GroupMember), callerId);

        // Anyone can leave their own group, including the owner. When the owner leaves we either
        // transfer ownership to a remaining member, or — if they're the last member — delete the
        // now-empty group (leaving never strands a group without an owner).
        if (membership.Role == GroupRole.Owner)
        {
            var others = await context.GroupMembers
                .Where(m => m.GroupId == request.GroupId && m.UserId != callerId)
                .OrderBy(m => m.JoinedAt)
                .ToListAsync(cancellationToken);

            var group = await context.Groups
                .FirstOrDefaultAsync(g => g.Id == request.GroupId, cancellationToken)
                ?? throw new NotFoundException(nameof(Group), request.GroupId);

            if (others.Count == 0)
            {
                // Sole member leaving — delete the empty group (cascade removes membership + sessions),
                // mirroring DeleteGroup. No activity log: the group (and its logs) are going away.
                context.Groups.Remove(group);
                await context.SaveChangesAsync(cancellationToken);
                return;
            }

            // Transfer ownership to a successor (prefer an existing Admin, else the longest-standing member).
            var successor = others.FirstOrDefault(m => m.Role == GroupRole.Admin) ?? others[0];
            successor.SetRole(GroupRole.Owner);
            group.TransferOwnership(successor.UserId);

            context.GroupMembers.Remove(membership);
            await context.ActivityLogs.AddAsync(
                ActivityLog.Create(request.GroupId, callerId, actorName, ActivityType.MemberLeft,
                    $"{actorName} left the group — ownership transferred"),
                cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            return;
        }

        context.GroupMembers.Remove(membership);
        await context.ActivityLogs.AddAsync(
            ActivityLog.Create(request.GroupId, callerId, actorName, ActivityType.MemberLeft,
                $"{actorName} left the group"),
            cancellationToken);

        await context.SaveChangesAsync(cancellationToken);
    }
}
