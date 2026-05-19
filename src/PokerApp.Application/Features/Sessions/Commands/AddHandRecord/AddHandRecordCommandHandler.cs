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

        var isMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == userId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

        if (session.Status != SessionStatus.Active)
            throw new BadRequestException("Hands can only be logged during an active session.");

        var hand = HandRecord.Create(session.Id, request.WinnerName, request.PotAmount, request.Note, userId);
        await context.HandRecords.AddAsync(hand, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new HandRecordResponse(hand.Id, hand.SessionId, hand.WinnerName, hand.PotAmount, hand.Note, hand.CreatedAt);
    }
}
