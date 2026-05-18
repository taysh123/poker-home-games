using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Features.Settlements;
using PokerApp.Application.Features.Settlements.Commands.CalculateSettlements;
using PokerApp.Application.Features.Settlements.Commands.MarkSettlementPaid;
using PokerApp.Application.Features.Settlements.Queries.GetMyPendingSettlements;
using PokerApp.Application.Features.Settlements.Queries.GetSessionSettlements;

namespace PokerApp.API.Controllers;

[Authorize]
[ApiController]
public class SettlementsController(IMediator mediator) : ControllerBase
{
    /// <summary>Calculates optimized settlements for a finished session. Safe to call multiple times.</summary>
    [HttpPost("api/sessions/{sessionId:guid}/settlements/calculate")]
    [ProducesResponseType(typeof(List<SettlementDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CalculateSettlements(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new CalculateSettlementsCommand(sessionId), cancellationToken);
        return Ok(result);
    }

    /// <summary>Returns all settlements for a session, including financial summary.</summary>
    [HttpGet("api/sessions/{sessionId:guid}/settlements")]
    [ProducesResponseType(typeof(SessionSettlementsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSessionSettlements(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetSessionSettlementsQuery(sessionId), cancellationToken);
        return Ok(result);
    }

    /// <summary>Returns all pending settlements where the caller is payer or receiver, across all sessions.</summary>
    [HttpGet("api/settlements/pending")]
    [ProducesResponseType(typeof(List<MyPendingSettlementDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyPendingSettlements(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetMyPendingSettlementsQuery(), cancellationToken);
        return Ok(result);
    }

    /// <summary>Marks a settlement as paid. Only the payer or receiver can call this.</summary>
    [HttpPost("api/settlements/{settlementId:guid}/mark-paid")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkSettlementPaid(
        Guid settlementId,
        CancellationToken cancellationToken)
    {
        await mediator.Send(new MarkSettlementPaidCommand(settlementId), cancellationToken);
        return NoContent();
    }
}
