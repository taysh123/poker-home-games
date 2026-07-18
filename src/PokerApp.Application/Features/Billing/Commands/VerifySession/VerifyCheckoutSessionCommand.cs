using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Billing.Commands.VerifySession;

/// <summary>
/// Paddle web success-redirect grant (instant unlock): the success URL carries the Paddle transaction id
/// (<c>?_ptxn=txn_…</c>); we retrieve it and, if it's a paid/completed SUBSCRIPTION transaction, idempotently
/// upsert the SAME Subscription the webhook upserts (keyed by Store + OriginalTransactionId = the Paddle
/// subscription id <c>sub_…</c>) and return the computed entitlement. Webhooks remain the source of truth — this
/// is only the redirect fallback so the UX isn't gated on webhook latency. <c>SessionId</c> is the Paddle
/// transaction id for this provider.
/// </summary>
public sealed record VerifyCheckoutSessionCommand(string SessionId) : IRequest<EntitlementDto>;

public sealed class VerifyCheckoutSessionCommandValidator : AbstractValidator<VerifyCheckoutSessionCommand>
{
    public VerifyCheckoutSessionCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty().MaximumLength(255);
    }
}

public sealed class VerifyCheckoutSessionCommandHandler(
    IBillingVerifier verifier,
    IApplicationDbContext context,
    IEntitlementService entitlements,
    IAuditLog audit,
    ICurrentUserService currentUser) : IRequestHandler<VerifyCheckoutSessionCommand, EntitlementDto>
{
    public async Task<EntitlementDto> Handle(VerifyCheckoutSessionCommand request, CancellationToken cancellationToken)
    {
        // The Paddle verifier retrieves the transaction (+ its subscription for the period) and returns null unless
        // it's a paid/completed subscription transaction.
        var verified = await verifier.VerifyAsync(SubscriptionStore.Paddle, request.SessionId, cancellationToken)
            ?? throw new BadRequestException("Checkout session could not be verified.");

        // Bind the grant to the caller: Paddle exposes the transaction id in the ?_ptxn= redirect URL, so a leaked
        // id must NOT let another account claim the subscription. custom_data.app_user_id (set at checkout) is the
        // real owner. Same generic error as an unverifiable txn — never reveal "valid but not yours".
        if (verified.AppUserId is { Length: > 0 } owner && owner != currentUser.UserId.ToString())
            throw new BadRequestException("Checkout session could not be verified.");

        var now = DateTime.UtcNow;
        var sub = await context.Subscriptions.FirstOrDefaultAsync(
            s => s.Store == verified.Store && s.OriginalTransactionId == verified.OriginalTransactionId,
            cancellationToken);

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
        audit.Record(AuditCategory.SubscriptionLifecycle, "verify_session", currentUser.UserId,
            new { store = "paddle", verified.ProductId, verified.IsSandbox, status = verified.Status.ToString() });
        return await entitlements.GetAsync(currentUser.UserId, cancellationToken);
    }
}
