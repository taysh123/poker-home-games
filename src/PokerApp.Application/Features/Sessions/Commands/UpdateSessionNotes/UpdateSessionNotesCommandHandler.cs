using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Sessions.Commands.UpdateSessionNotes;

public sealed class UpdateSessionNotesCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateSessionNotesCommand>
{
    public async Task Handle(UpdateSessionNotesCommand request, CancellationToken cancellationToken)
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

        session.UpdateNotes(request.Notes);
        await context.SaveChangesAsync(cancellationToken);
    }
}
