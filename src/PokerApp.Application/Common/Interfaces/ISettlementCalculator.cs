namespace PokerApp.Application.Common.Interfaces;

public sealed record PlayerNetBalance(Guid UserId, decimal NetBalance);
public sealed record SettlementInstruction(Guid PayerUserId, Guid ReceiverUserId, decimal Amount);

public interface ISettlementCalculator
{
    IEnumerable<SettlementInstruction> Calculate(IEnumerable<PlayerNetBalance> balances);
}
