using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.AddHandRecord;

public sealed class AddHandRecordCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<AddHandRecordCommand, HandRecordResponse>
{
    public async Task<HandRecordResponse> Handle(AddHandRecordCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

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

        if (session.Status != SessionStatus.Active)
            throw new BadRequestException("Hands can only be logged during an active session.");

        var hand = HandRecord.Create(session.Id, request.WinnerName, request.PotAmount, request.Note, userId);
        await context.HandRecords.AddAsync(hand, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new HandRecordResponse(hand.Id, hand.SessionId, hand.WinnerName, hand.PotAmount, hand.Note, hand.CreatedAt);
    }
}
