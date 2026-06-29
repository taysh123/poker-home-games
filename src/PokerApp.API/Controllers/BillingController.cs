using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Billing.Commands;
using PokerApp.Application.Features.Billing.Commands.CreateCheckoutSession;
using PokerApp.Application.Features.Billing.Commands.RedeemTopUp;
using PokerApp.Application.Features.Billing.Commands.VerifySession;
using PokerApp.Application.Features.Billing.Queries.GetTopUpBundles;
using PokerApp.Application.Features.Entitlements.Queries;

namespace PokerApp.API.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class BillingController(IMediator mediator) : ControllerBase
{
    /// <summary>Server-computed entitlement (the client trusts this, not local state).</summary>
    [HttpGet("entitlements")]
    [ProducesResponseType(typeof(EntitlementDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEntitlements(CancellationToken cancellationToken)
        => Ok(await mediator.Send(new GetEntitlementQuery(), cancellationToken));

    /// <summary>Validate a completed purchase with the store and refresh the entitlement.</summary>
    [HttpPost("billing/validate")]
    [ProducesResponseType(typeof(EntitlementDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Validate([FromBody] ValidatePurchaseCommand command, CancellationToken cancellationToken)
        => Ok(await mediator.Send(command, cancellationToken));

    /// <summary>Verify a Paddle checkout (transaction) on the web success redirect → instant, idempotent unlock.
    /// Upserts the SAME Subscription the webhook upserts; 400 when the transaction can't be verified.</summary>
    [HttpPost("billing/verify-session")]
    [ProducesResponseType(typeof(EntitlementDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifySession([FromBody] VerifyCheckoutSessionCommand command, CancellationToken cancellationToken)
        => Ok(await mediator.Send(command, cancellationToken));

    /// <summary>Create a Stripe Checkout session (web billing). Fails closed (400) when Stripe isn't configured.</summary>
    [HttpPost("billing/checkout")]
    [ProducesResponseType(typeof(CheckoutSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Checkout([FromBody] CreateCheckoutSessionCommand command, CancellationToken cancellationToken)
        => Ok(await mediator.Send(command, cancellationToken));

    /// <summary>List configured consumable AI-credit bundles (empty when top-ups are disabled).</summary>
    [HttpGet("billing/topups")]
    [ProducesResponseType(typeof(IReadOnlyList<TopUpBundleDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTopUps(CancellationToken cancellationToken)
        => Ok(await mediator.Send(new GetTopUpBundlesQuery(), cancellationToken));

    /// <summary>Redeem a consumable top-up bundle (fails closed when disabled / unknown product).</summary>
    [HttpPost("billing/topups/redeem")]
    [ProducesResponseType(typeof(TopUpResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RedeemTopUp([FromBody] RedeemTopUpCommand command, CancellationToken cancellationToken)
        => Ok(await mediator.Send(command, cancellationToken));
}
