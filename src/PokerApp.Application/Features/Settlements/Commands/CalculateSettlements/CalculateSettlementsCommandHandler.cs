using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Settlements.Commands.CalculateSettlements;

public sealed class CalculateSettlementsCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    ISettlementCalculator calculator) : IRequestHandler<CalculateSettlementsCommand, List<SettlementDto>>
{
    public async Task<List<SettlementDto>> Handle(CalculateSettlementsCommand request, CancellationToken cancellationToken)
    {
        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        if (session.Status != SessionStatus.Finished)
            throw new BadRequestException("Settlements can only be calculated for finished sessions.");

        var callerId = currentUserService.UserId;
        var callerIsMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == callerId, cancellationToken);

        if (!callerIsMember)
            throw new UnauthorizedException("You are not a member of this group.");

        // Compute per-player net balances from raw buy-in / cash-out records
        var buyInSums = await context.BuyIns
            .Where(b => b.SessionId == request.SessionId)
            .GroupBy(b => b.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(b => b.Amount) })
            .ToListAsync(cancellationToken);

        var cashOutSums = await context.CashOuts
            .Where(c => c.SessionId == request.SessionId)
            .GroupBy(c => c.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(c => c.Amount) })
            .ToListAsync(cancellationToken);

        var allPlayerIds = buyInSums.Select(b => b.UserId)
            .Union(cashOutSums.Select(c => c.UserId))
            .ToHashSet();

        var netBalances = allPlayerIds.Select(userId =>
        {
            var totalBuyIn  = buyInSums.FirstOrDefault(b => b.UserId == userId)?.Total ?? 0;
            var totalCashOut = cashOutSums.FirstOrDefault(c => c.UserId == userId)?.Total ?? 0;
            return new PlayerNetBalance(userId, totalCashOut - totalBuyIn);
        }).ToList();

        var instructions = calculator.Calculate(netBalances).ToList();

        // Load usernames for DTO population
        var users = await context.Users
            .Where(u => allPlayerIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Username })
            .ToDictionaryAsync(u => u.Id, u => u.Username, cancellationToken);

        // Idempotent: replace any existing pending settlements for this session
        var existing = await context.Settlements
            .Where(s => s.SessionId == request.SessionId && s.Status == SettlementStatus.Pending)
            .ToListAsync(cancellationToken);
        context.Settlements.RemoveRange(existing);

        var newSettlements = instructions
            .Select(i => Settlement.Create(request.SessionId, i.PayerUserId, i.ReceiverUserId, i.Amount))
            .ToList();

        await context.Settlements.AddRangeAsync(newSettlements, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return newSettlements.Select(s => new SettlementDto(
            s.Id,
            s.PayerUserId,
            users.GetValueOrDefault(s.PayerUserId, "Unknown"),
            s.ReceiverUserId,
            users.GetValueOrDefault(s.ReceiverUserId, "Unknown"),
            s.Amount,
            s.Status.ToString()
        )).ToList();
    }
}
