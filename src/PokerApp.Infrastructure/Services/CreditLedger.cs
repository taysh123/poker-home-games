using System.Data;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Server-authoritative AI credit ledger. Lazy per-period grants, atomic decrement with
/// DB-level idempotency (unique key), refund-on-failure. Fail-closed. Uses a serializable
/// transaction on relational providers; the materialized balance reconciles from the ledger.
/// </summary>
public sealed class CreditLedger(AppDbContext db) : ICreditLedger
{
    private static string PeriodKey(AiCreditPolicy p, DateTime now) =>
        p.Kind == "monthly" ? $"premium:{now:yyyy-MM}" : "lifetime";

    public async Task<int> GetRemainingAsync(Guid userId, AiCreditPolicy policy, DateTime nowUtc, CancellationToken ct = default)
    {
        if (policy.Credits <= 0) return 0;
        var periodKey = PeriodKey(policy, nowUtc);
        var bal = await db.CreditBalances.AsNoTracking()
            .FirstOrDefaultAsync(b => b.UserId == userId && b.PeriodKey == periodKey, ct);
        return bal?.Remaining ?? policy.Credits; // not yet granted ⇒ full quota available
    }

    public async Task<CreditDecision> TryConsumeAsync(
        Guid userId, AiCreditPolicy policy, string idempotencyKey, DateTime nowUtc, CancellationToken ct = default)
    {
        if (policy.Credits <= 0) return new CreditDecision(false, 0, CreditDenyReason.NoCredits); // fail closed

        if (db.Database.IsRelational())
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var result = await ConsumeCoreAsync(userId, policy, idempotencyKey, nowUtc, ct);
            await tx.CommitAsync(ct);
            return result;
        }
        return await ConsumeCoreAsync(userId, policy, idempotencyKey, nowUtc, ct);
    }

    private async Task<CreditDecision> ConsumeCoreAsync(
        Guid userId, AiCreditPolicy policy, string idempotencyKey, DateTime nowUtc, CancellationToken ct)
    {
        var periodKey = PeriodKey(policy, nowUtc);
        var bal = await EnsureBalanceAsync(userId, policy, periodKey, nowUtc, ct);

        // Idempotency: a retried request returns the prior outcome, never double-charges.
        if (await db.CreditLedgerEntries.AnyAsync(e => e.IdempotencyKey == idempotencyKey, ct))
            return new CreditDecision(true, bal.Remaining, CreditDenyReason.None);

        if (bal.LastConsumedAtUtc is DateTime last &&
            (nowUtc - last).TotalSeconds < policy.MinIntervalSeconds)
            return new CreditDecision(false, bal.Remaining, CreditDenyReason.RateLimited);

        if (!bal.TryConsume(nowUtc))
            return new CreditDecision(false, 0, CreditDenyReason.NoCredits);

        db.CreditLedgerEntries.Add(CreditLedgerEntry.Create(
            userId, CreditEntryType.Consume, -1, periodKey, "ai_analysis", idempotencyKey));
        await db.SaveChangesAsync(ct);
        return new CreditDecision(true, bal.Remaining, CreditDenyReason.None);
    }

    public async Task RefundAsync(Guid userId, string consumeIdempotencyKey, DateTime nowUtc, CancellationToken ct = default)
    {
        var consume = await db.CreditLedgerEntries
            .FirstOrDefaultAsync(e => e.IdempotencyKey == consumeIdempotencyKey && e.Type == CreditEntryType.Consume, ct);
        if (consume is null) return;

        var refundKey = $"refund:{consumeIdempotencyKey}";
        if (await db.CreditLedgerEntries.AnyAsync(e => e.IdempotencyKey == refundKey, ct)) return; // already refunded

        var bal = await db.CreditBalances
            .FirstOrDefaultAsync(b => b.UserId == userId && b.PeriodKey == consume.PeriodKey, ct);
        if (bal is null) return;

        bal.Refund();
        db.CreditLedgerEntries.Add(CreditLedgerEntry.Create(
            userId, CreditEntryType.Refund, +1, consume.PeriodKey, "refund", refundKey, consumeIdempotencyKey));
        await db.SaveChangesAsync(ct);
    }

    public async Task GrantTopUpAsync(
        Guid userId, AiCreditPolicy policy, int amount, string idempotencyKey, DateTime nowUtc, CancellationToken ct = default)
    {
        if (amount <= 0) return;
        if (await db.CreditLedgerEntries.AnyAsync(e => e.IdempotencyKey == idempotencyKey, ct)) return; // idempotent

        var periodKey = PeriodKey(policy, nowUtc);
        var bal = await EnsureBalanceAsync(userId, policy, periodKey, nowUtc, ct);
        bal.AddGrant(amount);
        db.CreditLedgerEntries.Add(CreditLedgerEntry.Create(
            userId, CreditEntryType.GrantTopUp, amount, periodKey, "topup", idempotencyKey));
        await db.SaveChangesAsync(ct);
    }

    private async Task<CreditBalance> EnsureBalanceAsync(
        Guid userId, AiCreditPolicy policy, string periodKey, DateTime nowUtc, CancellationToken ct)
    {
        var bal = await db.CreditBalances.FirstOrDefaultAsync(b => b.UserId == userId && b.PeriodKey == periodKey, ct);
        if (bal is not null) return bal;

        bal = CreditBalance.Create(userId, periodKey, policy.Credits);
        db.CreditBalances.Add(bal);
        var grantType = policy.Kind == "monthly" ? CreditEntryType.GrantSubscriptionPeriod : CreditEntryType.GrantOnboarding;
        db.CreditLedgerEntries.Add(CreditLedgerEntry.Create(
            userId, grantType, policy.Credits, periodKey, "grant", $"grant:{periodKey}:{userId}"));
        await db.SaveChangesAsync(ct);
        return bal;
    }
}
