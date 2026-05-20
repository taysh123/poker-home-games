using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.UpdateSessionName;

public sealed class UpdateSessionNameCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateSessionNameCommand>
{
    public async Task Handle(UpdateSessionNameCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        bool hasAccess;
        if (session.GroupId.HasValue)
        {
            var member = await context.GroupMembers
                .FirstOrDefaultAsync(
                    m => m.GroupId == session.GroupId.Value && m.UserId == userId,
                    cancellationToken);
            hasAccess = member is not null &&
                        (member.Role == GroupRole.Admin || member.Role == GroupRole.Owner);
        }
        else
        {
            hasAccess = session.CreatorId == userId;
        }

        if (!hasAccess)
            throw new UnauthorizedException("Only admins and owners can rename sessions.");

        session.UpdateName(request.Name);
        await context.SaveChangesAsync(cancellationToken);
    }
}
