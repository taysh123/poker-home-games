using PokerApp.Application.Common.Interfaces;
using PokerApp.Infrastructure.Settings;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Pure, deterministic abuse scoring — easily unit-tested in isolation. Turns raw counts (accounts on
/// a device, recent consumes) into weighted signals + a block decision. Blocking is gated on
/// <see cref="FraudSettings.EnforceBlocking"/> so detection can run safely before enforcement is tuned.
/// </summary>
public static class FraudScoring
{
    public static AbuseAssessment Evaluate(int accountsOnDevice, int analysesInWindow, FraudSettings s)
    {
        var signals = new List<AbuseSignal>();

        if (accountsOnDevice > s.MaxAccountsPerDevice)
            signals.Add(new AbuseSignal("multi_account_device", s.MultiAccountWeight));

        if (analysesInWindow > s.MaxAnalysesPerWindow)
            signals.Add(new AbuseSignal("velocity_exceeded", s.VelocityWeight));

        var score = signals.Sum(x => x.Weight);
        var shouldBlock = s.EnforceBlocking && score >= s.BlockScore;
        return new AbuseAssessment(score, shouldBlock, signals);
    }
}
