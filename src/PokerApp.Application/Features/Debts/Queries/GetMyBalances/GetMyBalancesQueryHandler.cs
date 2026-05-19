using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Debts.Queries.GetMyBalances;

public sealed class GetMyBalancesQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetMyBalancesQuery, IReadOnlyList<BalanceEntryDto>>
{
    public async Task<IReadOnlyList<BalanceEntryDto>> Handle(GetMyBalancesQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        // --- Session settlements ---
        var settlements = await context.Settlements
            .AsNoTracking()
            .Where(s => s.Status == SettlementStatus.Pending &&
                        (s.PayerUserId == userId || s.ReceiverUserId == userId))
            .Select(s => new
            {
                s.Id,
                s.SessionId,
                s.PayerUserId,
                PayerName = s.PayerUser.Username,
                s.ReceiverUserId,
                ReceiverName = s.ReceiverUser.Username,
                s.Amount,
                SessionName = s.Session.Name,
            })
            .ToListAsync(cancellationToken);

        // --- Manual debts ---
        var debts = await context.Debts
            .AsNoTracking()
            .Where(d => d.Status == SettlementStatus.Pending &&
                        (d.FromUserId == userId || d.ToUserId == userId))
            .Select(d => new
            {
                d.Id,
                d.FromUserId,
                FromName = d.FromUser.Username,
                d.ToUserId,
                ToName = d.ToUser.Username,
                d.Amount,
                d.Reason,
            })
            .ToListAsync(cancellationToken);

        // Build per-counterparty map
        var entries = new Dictionary<Guid, (string Username, decimal Net, List<BalanceItemDto> Items)>();

        void EnsureEntry(Guid counterpartyId, string counterpartyName)
        {
            if (!entries.ContainsKey(counterpartyId))
                entries[counterpartyId] = (counterpartyName, 0m, []);
        }

        foreach (var s in settlements)
        {
            bool youOwe = s.PayerUserId == userId;
            var counterpartyId = youOwe ? s.ReceiverUserId : s.PayerUserId;
            var counterpartyName = youOwe ? s.ReceiverName : s.PayerName;
            var sign = youOwe ? -1m : 1m;

            EnsureEntry(counterpartyId, counterpartyName);
            var (name, net, items) = entries[counterpartyId];
            items.Add(new BalanceItemDto(s.Id, "Session", s.Amount, youOwe, s.SessionName, s.SessionId));
            entries[counterpartyId] = (name, net + sign * s.Amount, items);
        }

        foreach (var d in debts)
        {
            bool youOwe = d.FromUserId == userId;
            var counterpartyId = youOwe ? d.ToUserId : d.FromUserId;
            var counterpartyName = youOwe ? d.ToName : d.FromName;
            var sign = youOwe ? -1m : 1m;
            var description = d.Reason ?? "Manual debt";

            EnsureEntry(counterpartyId, counterpartyName);
            var (name, net, items) = entries[counterpartyId];
            items.Add(new BalanceItemDto(d.Id, "Debt", d.Amount, youOwe, description, null));
            entries[counterpartyId] = (name, net + sign * d.Amount, items);
        }

        return entries
            .Select(e => new BalanceEntryDto(e.Key, e.Value.Username, e.Value.Net, e.Value.Items))
            .OrderByDescending(e => Math.Abs(e.NetBalance))
            .ToList();
    }
}
