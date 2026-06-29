using FluentValidation;
using MediatR;
using PokerApp.Application.Common;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Billing.Commands.RedeemTopUp;

public sealed record TopUpResultDto(int CreditsAdded, int Remaining);

/// <summary>Redeem a consumable top-up bundle into the user's current credit period.</summary>
public sealed record RedeemTopUpCommand(string Store, string PurchaseToken, string ProductId)
    : IRequest<TopUpResultDto>;

public sealed class RedeemTopUpCommandValidator : AbstractValidator<RedeemTopUpCommand>
{
    public RedeemTopUpCommandValidator()
    {
        RuleFor(x => x.Store).NotEmpty().Must(s => SubscriptionStoreParser.IsValid(s))
            .WithMessage("Store must be one of 'apple', 'google', 'stripe', 'revenuecat'.");
        RuleFor(x => x.PurchaseToken).NotEmpty();
        RuleFor(x => x.ProductId).NotEmpty();
    }
}

/// <summary>
/// Grants a configured top-up bundle's credits, idempotently keyed by the store + purchase token.
/// FAIL-CLOSED: unknown/disabled product ⇒ BadRequest (no grant). NOTE: consumable receipt verification
/// with the store is a deploy-time seam — safe today because top-ups are disabled + empty by default.
/// </summary>
public sealed class RedeemTopUpCommandHandler(
    ITopUpCatalog catalog,
    IEntitlementService entitlements,
    IAiCreditPolicyProvider policyProvider,
    ICreditLedger ledger,
    IAuditLog audit,
    ICurrentUserService currentUser) : IRequestHandler<RedeemTopUpCommand, TopUpResultDto>
{
    public async Task<TopUpResultDto> Handle(RedeemTopUpCommand request, CancellationToken cancellationToken)
    {
        var bundle = catalog.Find(request.ProductId)
            ?? throw new BadRequestException("Unknown or unavailable top-up bundle.");

        var userId = currentUser.UserId;
        var now = DateTime.UtcNow;
        var entitlement = await entitlements.GetAsync(userId, cancellationToken);
        var policy = policyProvider.ForTier(entitlement.IsPremium ? "premium" : "free");

        var idempotencyKey = $"topup:{request.Store}:{request.PurchaseToken}";
        await ledger.GrantTopUpAsync(userId, policy, bundle.Credits, idempotencyKey, now, cancellationToken);
        var remaining = await ledger.GetRemainingAsync(userId, policy, now, cancellationToken);

        audit.Record(AuditCategory.CreditTopUp, request.ProductId, userId,
            new { credits = bundle.Credits, store = request.Store, remaining });

        return new TopUpResultDto(bundle.Credits, remaining);
    }
}
