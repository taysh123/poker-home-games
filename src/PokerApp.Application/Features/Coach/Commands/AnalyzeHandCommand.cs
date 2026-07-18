using FluentValidation;
using MediatR;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Coach.Commands;

public sealed record AnalyzeHandCommand(
    string Kind,
    string? Text,
    string? HeroHand,
    string? HeroPosition,
    string? Question,
    string IdempotencyKey,
    string? DeviceId = null,
    string? Board = null,
    string? VillainPosition = null,
    int? StackBb = null,
    string? Format = null) : IRequest<CoachAnalysisResult>;

public sealed class AnalyzeHandCommandValidator : AbstractValidator<AnalyzeHandCommand>
{
    public AnalyzeHandCommandValidator()
    {
        // Bound every field: the free-text inputs are forwarded to a paid AI model
        // (token-bomb / cost-abuse / injection surface) and IdempotencyKey persists to a
        // 200-char column (an over-long key would 500 on insert instead of 400-ing here).
        RuleFor(x => x.Kind).NotEmpty().MaximumLength(40);
        RuleFor(x => x.IdempotencyKey).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Text).MaximumLength(4000);
        RuleFor(x => x.HeroHand).MaximumLength(32);
        RuleFor(x => x.HeroPosition).MaximumLength(32);
        RuleFor(x => x.Question).MaximumLength(1000);
        RuleFor(x => x.DeviceId).MaximumLength(200);
        RuleFor(x => x.Board).MaximumLength(64);
        RuleFor(x => x.VillainPosition).MaximumLength(32);
        RuleFor(x => x.Format).MaximumLength(16);
        RuleFor(x => x.StackBb).GreaterThan(0).When(x => x.StackBb.HasValue);
    }
}

/// <summary>
/// Server AI proxy + enforcement. Requires a verified account (endpoint is [Authorize]); reserves a
/// credit atomically BEFORE calling the model; refunds on provider failure. Fail-closed.
/// </summary>
public sealed class AnalyzeHandCommandHandler(
    IEntitlementService entitlements,
    IAiCreditPolicyProvider policyProvider,
    ICreditLedger ledger,
    ICoachAiProvider aiProvider,
    IFraudEvaluator fraud,
    IAuditLog audit,
    ICurrentUserService currentUser) : IRequestHandler<AnalyzeHandCommand, CoachAnalysisResult>
{
    public async Task<CoachAnalysisResult> Handle(AnalyzeHandCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId; // [Authorize] guarantees a verified account — no anonymous AI
        var now = DateTime.UtcNow;

        var entitlement = await entitlements.GetAsync(userId, cancellationToken);
        var policy = policyProvider.ForTier(entitlement.IsPremium ? "premium" : "free");

        // Fraud: record the device + score for abuse (advisory unless blocking is enforced in config).
        await fraud.RecordDeviceAsync(userId, request.DeviceId, now, cancellationToken);
        var assessment = await fraud.EvaluateAsync(userId, request.DeviceId, now, cancellationToken);
        if (assessment.ShouldBlock)
            throw new TooManyRequestsException("This request was blocked for unusual activity.");

        var decision = await ledger.TryConsumeAsync(userId, policy, request.IdempotencyKey, now, cancellationToken);
        if (!decision.Allowed)
        {
            if (decision.Reason == CreditDenyReason.RateLimited)
                throw new TooManyRequestsException("Easy — wait a moment before the next analysis.");
            throw new QuotaExceededException("You're out of AI analyses. Upgrade to Premium for more.");
        }
        audit.Record(AuditCategory.CreditSpend, "ai_analysis", userId,
            new { remaining = decision.Remaining, idempotencyKey = request.IdempotencyKey });

        try
        {
            var result = await aiProvider.AnalyzeAsync(
                new CoachAnalysisInput(request.Kind, request.Text, request.HeroHand, request.HeroPosition, request.Question,
                    request.Board, request.VillainPosition, request.StackBb, request.Format),
                cancellationToken);
            audit.Record(AuditCategory.AiUsage, request.Kind, userId, new { providerId = result.ProviderId });
            audit.Record(AuditCategory.AiCost, result.ProviderId, userId, new { kind = request.Kind }); // cost hook (future paid providers)
            return result;
        }
        catch
        {
            // Provider failed after the reserve — refund so the credit isn't burned.
            await ledger.RefundAsync(userId, request.IdempotencyKey, now, CancellationToken.None);
            audit.Record(AuditCategory.CreditSpend, "refund", userId, new { idempotencyKey = request.IdempotencyKey });
            throw;
        }
    }
}
