using MediatR;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Coach.Queries;

public sealed record CoachCreditsDto(int Remaining, int Total, string PolicyKind, bool IsPremium);

public sealed record GetCoachCreditsQuery : IRequest<CoachCreditsDto>;

public sealed class GetCoachCreditsQueryHandler(
    IEntitlementService entitlements,
    IAiCreditPolicyProvider policyProvider,
    ICreditLedger ledger,
    ICurrentUserService currentUser) : IRequestHandler<GetCoachCreditsQuery, CoachCreditsDto>
{
    public async Task<CoachCreditsDto> Handle(GetCoachCreditsQuery request, CancellationToken cancellationToken)
    {
        var entitlement = await entitlements.GetAsync(currentUser.UserId, cancellationToken);
        var policy = policyProvider.ForTier(entitlement.IsPremium ? "premium" : "free");
        var remaining = await ledger.GetRemainingAsync(currentUser.UserId, policy, DateTime.UtcNow, cancellationToken);
        return new CoachCreditsDto(remaining, policy.Credits, policy.Kind, entitlement.IsPremium);
    }
}
