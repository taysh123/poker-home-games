using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Billing.Commands;

/// <summary>Client-initiated post-purchase validation. Server verifies the receipt with the store
/// (mock in B2) and upserts the authoritative Subscription, then returns the computed entitlement.</summary>
public sealed record ValidatePurchaseCommand(string Store, string Token) : IRequest<EntitlementDto>;

public sealed class ValidatePurchaseCommandValidator : AbstractValidator<ValidatePurchaseCommand>
{
    public ValidatePurchaseCommandValidator()
    {
        RuleFor(x => x.Store).NotEmpty().Must(s => s is "apple" or "google")
            .WithMessage("Store must be 'apple' or 'google'.");
        RuleFor(x => x.Token).NotEmpty();
    }
}

public sealed class ValidatePurchaseCommandHandler(
    IBillingVerifier verifier,
    IApplicationDbContext context,
    IEntitlementService entitlements,
    ICurrentUserService currentUser) : IRequestHandler<ValidatePurchaseCommand, EntitlementDto>
{
    public async Task<EntitlementDto> Handle(ValidatePurchaseCommand request, CancellationToken cancellationToken)
    {
        var store = request.Store == "apple" ? SubscriptionStore.Apple : SubscriptionStore.Google;
        var verified = await verifier.VerifyAsync(store, request.Token, cancellationToken)
            ?? throw new BadRequestException("Purchase could not be validated.");

        var sub = await context.Subscriptions.FirstOrDefaultAsync(
            s => s.Store == verified.Store && s.OriginalTransactionId == verified.OriginalTransactionId,
            cancellationToken);

        var now = DateTime.UtcNow;
        if (sub is null)
        {
            sub = Subscription.Create(currentUser.UserId, verified.Store, verified.ProductId,
                verified.OriginalTransactionId, verified.PeriodStart, verified.PeriodEnd,
                verified.AutoRenew, verified.IsSandbox, now);
            await context.Subscriptions.AddAsync(sub, cancellationToken);
        }
        else
        {
            sub.Sync(verified.ProductId, verified.PeriodStart, verified.PeriodEnd,
                verified.AutoRenew, verified.IsSandbox, verified.Status, now);
        }

        await context.SaveChangesAsync(cancellationToken);
        return await entitlements.GetAsync(currentUser.UserId, cancellationToken);
    }
}
