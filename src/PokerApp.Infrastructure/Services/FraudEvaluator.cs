using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;
using PokerApp.Infrastructure.Settings;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Records device bindings and scores accounts for abuse (multi-account on a device + AI consume
/// velocity from the ledger). Detection + audit always run; blocking only when configured.
/// </summary>
public sealed class FraudEvaluator(AppDbContext db, FraudSettings settings, IAuditLog audit) : IFraudEvaluator
{
    public async Task RecordDeviceAsync(Guid userId, string? deviceId, DateTime nowUtc, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(deviceId)) return;
        var binding = await db.DeviceBindings.FirstOrDefaultAsync(
            b => b.UserId == userId && b.DeviceId == deviceId, ct);
        if (binding is null)
            db.DeviceBindings.Add(DeviceBinding.Create(userId, deviceId, nowUtc));
        else
            binding.Touch(nowUtc);
        await db.SaveChangesAsync(ct);
    }

    public async Task<AbuseAssessment> EvaluateAsync(Guid userId, string? deviceId, DateTime nowUtc, CancellationToken ct = default)
    {
        var accountsOnDevice = string.IsNullOrWhiteSpace(deviceId)
            ? 0
            : await db.DeviceBindings.Where(b => b.DeviceId == deviceId).Select(b => b.UserId).Distinct().CountAsync(ct);

        var windowStart = nowUtc.AddSeconds(-settings.VelocityWindowSeconds);
        var analysesInWindow = await db.CreditLedgerEntries.CountAsync(
            e => e.UserId == userId && e.Type == CreditEntryType.Consume && e.CreatedAt >= windowStart, ct);

        var assessment = FraudScoring.Evaluate(accountsOnDevice, analysesInWindow, settings);

        if (assessment.Signals.Count > 0)
            audit.Record(AuditCategory.Fraud, "abuse_signals", userId, new
            {
                score = assessment.Score,
                block = assessment.ShouldBlock,
                signals = assessment.Signals.Select(s => s.Code).ToArray(),
                accountsOnDevice,
                analysesInWindow,
            });

        return assessment;
    }
}
