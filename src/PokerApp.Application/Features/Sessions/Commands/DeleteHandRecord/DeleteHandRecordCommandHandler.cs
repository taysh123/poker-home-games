using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Sessions.Commands.DeleteHandRecord;

public sealed class DeleteHandRecordCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<DeleteHandRecordCommand>
{
    public async Task Handle(DeleteHandRecordCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var hand = await context.HandRecords
            .FirstOrDefaultAsync(h => h.Id == request.HandRecordId && h.SessionId == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(HandRecord), request.HandRecordId);

        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        bool hasAccess;
        if (session.GroupId.HasValue)
            hasAccess = await context.GroupMembers
                .AnyAsync(m => m.GroupId == session.GroupId.Value && m.UserId == userId, cancellationToken);
        else
            hasAccess = session.CreatorId == userId;
        if (!hasAccess)
            throw new UnauthorizedException("You do not have access to this session.");

        if (hand.CreatedByUserId != userId)
            throw new UnauthorizedException("You can only delete hands you logged.");

        context.HandRecords.Remove(hand);
        await context.SaveChangesAsync(cancellationToken);
    }
}
