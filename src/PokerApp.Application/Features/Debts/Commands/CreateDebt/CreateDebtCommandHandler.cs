using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Debts.Commands.CreateDebt;

public sealed class CreateDebtCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CreateDebtCommand, DebtDto>
{
    public async Task<DebtDto> Handle(CreateDebtCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var group = await context.Groups
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == request.GroupId, cancellationToken)
            ?? throw new NotFoundException(nameof(Group), request.GroupId);

        var callerIsMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == request.GroupId && m.UserId == callerId, cancellationToken);
        if (!callerIsMember)
            throw new UnauthorizedException("You are not a member of this group.");

        var bothMembers = await context.GroupMembers
            .Where(m => m.GroupId == request.GroupId &&
                        (m.UserId == request.FromUserId || m.UserId == request.ToUserId))
            .CountAsync(cancellationToken);
        if (bothMembers < 2)
            throw new BadRequestException("Both users must be members of the group.");

        var fromUser = await context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.FromUserId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), request.FromUserId);

        var toUser = await context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.ToUserId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), request.ToUserId);

        var debt = Debt.Create(request.GroupId, request.FromUserId, request.ToUserId, request.Amount, request.Reason, callerId);
        await context.Debts.AddAsync(debt, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new DebtDto(debt.Id, group.Id, group.Name, fromUser.Id, fromUser.Username,
            toUser.Id, toUser.Username, debt.Amount, debt.Reason, debt.Status.ToString(), debt.CreatedAt);
    }
}
