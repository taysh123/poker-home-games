namespace PokerApp.Application.Common.Interfaces;

/// <summary>A single weighted abuse signal (e.g. multi-account on one device, request velocity).</summary>
public sealed record AbuseSignal(string Code, int Weight);

/// <summary>
/// The result of scoring a request. <see cref="ShouldBlock"/> is only ever true when blocking is
/// explicitly enforced AND the score crosses the configured threshold — advisory otherwise.
/// </summary>
public sealed record AbuseAssessment(int Score, bool ShouldBlock, IReadOnlyList<AbuseSignal> Signals);

/// <summary>
/// Records device bindings and scores accounts for abuse (multi-account / velocity). Server-side only;
/// thresholds + enforcement are configurable. Fail-closed only where explicitly enforced.
/// </summary>
public interface IFraudEvaluator
{
    Task RecordDeviceAsync(Guid userId, string? deviceId, DateTime nowUtc, CancellationToken ct = default);
    Task<AbuseAssessment> EvaluateAsync(Guid userId, string? deviceId, DateTime nowUtc, CancellationToken ct = default);
}
