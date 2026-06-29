using FluentValidation;
using MediatR;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Billing.Commands.CreateCheckoutSession;

public sealed record CheckoutSessionDto(string Url);

/// <summary>Creates a web checkout for the signed-in user + plan via the active provider (Paddle when configured,
/// else Stripe). FAIL-CLOSED: BadRequest "billing not configured" when no provider is wired — never fabricates a
/// checkout URL.</summary>
public sealed record CreateCheckoutSessionCommand(string Plan) : IRequest<CheckoutSessionDto>;

public sealed class CreateCheckoutSessionCommandValidator : AbstractValidator<CreateCheckoutSessionCommand>
{
    public CreateCheckoutSessionCommandValidator()
    {
        RuleFor(x => x.Plan).NotEmpty().Must(p => p is "monthly" or "yearly")
            .WithMessage("Plan must be 'monthly' or 'yearly'.");
    }
}

public sealed class CreateCheckoutSessionCommandHandler(
    ICheckoutService checkout,
    ICurrentUserService currentUser) : IRequestHandler<CreateCheckoutSessionCommand, CheckoutSessionDto>
{
    public async Task<CheckoutSessionDto> Handle(CreateCheckoutSessionCommand request, CancellationToken cancellationToken)
    {
        var url = await checkout.CreateSubscriptionCheckoutUrlAsync(currentUser.UserId, request.Plan, cancellationToken);
        if (string.IsNullOrEmpty(url))
            throw new BadRequestException("Web billing is not configured.");
        return new CheckoutSessionDto(url);
    }
}
