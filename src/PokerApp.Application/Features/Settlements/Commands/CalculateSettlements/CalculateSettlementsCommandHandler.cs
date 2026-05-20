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
    ISettlementCalculator calculator) : IRequestHandler<CalculateSettlementsCommand, CalculateSettlementsResult>
{
    public async Task<CalculateSettlementsResult> Handle(CalculateSettlementsCommand request, CancellationToken cancellationToken)
    {
        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        if (session.Status != SessionStatus.Finished)
            throw new BadRequestException("Settlements can only be calculated for finished sessions.");

        var callerId = currentUserService.UserId;

        if (session.GroupId.HasValue)
        {
            var isMember = await context.GroupMembers
                .AnyAsync(m => m.GroupId == session.GroupId.Value && m.UserId == callerId, cancellationToken);
            if (!isMember)
                throw new UnauthorizedException("You are not a member of this group.");
        }
        else if (session.CreatorId != callerId)
        {
            throw new UnauthorizedException("Only the session creator can calculate settlements.");
        }

        var allPlayers = await context.SessionPlayers
            .Where(sp => sp.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        var allBuyIns = await context.BuyIns
            .Where(b => b.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        var allCashOuts = await context.CashOuts
            .Where(c => c.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        // Split: players with a SettlementUserId participate in formal (digital) settlements;
        // unlinked guests have no SettlementUserId and are handled manually outside the app.
        var linkedPlayers = allPlayers.Where(sp => sp.SettlementUserId.HasValue).ToList();
        var unlinkedGuests = allPlayers.Where(sp => !sp.SettlementUserId.HasValue).ToList();

        // Group by SettlementUserId so linked guests aggregate into the linked user's balance
        var balancesBySettlementUser = linkedPlayers
            .GroupBy(sp => sp.SettlementUserId!.Value)
            .Select(group =>
            {
                var totalBuyIn = allBuyIns
                    .Where(b => group.Any(sp => b.SessionPlayerId == sp.Id || (b.SessionPlayerId == null && b.UserId == sp.UserId)))
                    .Sum(b => b.Amount);
                var totalCashOut = allCashOuts
                    .Where(c => group.Any(sp => c.SessionPlayerId == sp.Id || (c.SessionPlayerId == null && c.UserId == sp.UserId)))
                    .Sum(c => c.Amount);
                return new PlayerNetBalance(group.Key, totalCashOut - totalBuyIn);
            }).ToList();

        var instructions = calculator.Calculate(balancesBySettlementUser).ToList();

        var allLinkedPlayerIds = linkedPlayers.Select(sp => sp.SettlementUserId!.Value).ToHashSet();

        // Load usernames for DTO population
        var users = await context.Users
            .Where(u => allLinkedPlayerIds.Contains(u.Id))
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

        var settlementDtos = newSettlements.Select(s => new SettlementDto(
            s.Id,
            s.PayerUserId,
            users.GetValueOrDefault(s.PayerUserId, "Unknown"),
            s.ReceiverUserId,
            users.GetValueOrDefault(s.ReceiverUserId, "Unknown"),
            s.Amount,
            s.Status.ToString()
        )).ToList();

        // Compute net balance for each unlinked guest — callers must settle these in cash
        var guestBalanceDtos = unlinkedGuests
            .Select(sp =>
            {
                var totalBuyIn = allBuyIns.Where(b => b.SessionPlayerId == sp.Id).Sum(b => b.Amount);
                var totalCashOut = allCashOuts.Where(c => c.SessionPlayerId == sp.Id).Sum(c => c.Amount);
                return new GuestBalanceDto(sp.Id, sp.GuestName!, totalCashOut - totalBuyIn);
            })
            .Where(g => g.NetBalance != 0)
            .ToList();

        return new CalculateSettlementsResult(settlementDtos, guestBalanceDtos);
    }
}
