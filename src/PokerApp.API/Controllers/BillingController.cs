using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Billing.Commands;
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
}
