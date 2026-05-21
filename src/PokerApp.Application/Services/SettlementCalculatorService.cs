using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Services;

public sealed class SettlementCalculatorService : ISettlementCalculator
{
    public IEnumerable<SettlementInstruction> Calculate(IEnumerable<PlayerNetBalance> balances)
    {
        var debtors = balances
            .Where(b => b.NetBalance < 0)
            .Select(b => new MutableBalance(b.UserId, b.NetBalance))
            .OrderBy(b => b.Balance)  // most negative first
            .ToList();

        var creditors = balances
            .Where(b => b.NetBalance > 0)
            .Select(b => new MutableBalance(b.UserId, b.NetBalance))
            .OrderByDescending(b => b.Balance)  // most positive first
            .ToList();

        var settlements = new List<SettlementInstruction>();

        int d = 0, c = 0;
        while (d < debtors.Count && c < creditors.Count)
        {
            var debtor = debtors[d];
            var creditor = creditors[c];

            var amount = Math.Min(-debtor.Balance, creditor.Balance);
            amount = Math.Round(amount, 2);

            if (amount > 0)
                settlements.Add(new SettlementInstruction(debtor.UserId, creditor.UserId, amount));

            debtor.Balance += amount;
            creditor.Balance -= amount;

            if (Math.Abs(debtor.Balance) < 0.01m) d++;
            if (Math.Abs(creditor.Balance) < 0.01m) c++;
        }

        return settlements;
    }

    private sealed class MutableBalance(Guid userId, decimal balance)
    {
        public Guid UserId { get; } = userId;
        public decimal Balance { get; set; } = balance;
    }
}
