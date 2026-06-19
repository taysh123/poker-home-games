using PokerApp.Application.Common.Interfaces;
using PokerApp.Infrastructure.Identity;

namespace PokerApp.Infrastructure.Services;

public sealed class AiCreditPolicyProvider(AiCreditSettings settings) : IAiCreditPolicyProvider
{
    public AiCreditPolicy ForTier(string tier)
    {
        var p = tier == "premium" ? settings.Premium : settings.Free;
        return new AiCreditPolicy(p.Kind, p.Credits, p.MinIntervalSeconds);
    }
}
