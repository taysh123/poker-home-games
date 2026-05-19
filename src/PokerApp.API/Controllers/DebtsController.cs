using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Features.Debts.Commands.CancelDebt;
using PokerApp.Application.Features.Debts.Commands.CreateDebt;
using PokerApp.Application.Features.Debts.Commands.MarkDebtPaid;
using PokerApp.Application.Features.Debts.Queries.GetMyBalances;

namespace PokerApp.API.Controllers;

[Authorize]
[ApiController]
public class DebtsController(IMediator mediator) : ControllerBase
{
    /// <summary>Returns the caller's net balance with each counterparty, merging session settlements and manual debts.</summary>
    [HttpGet("api/balances")]
    [ProducesResponseType(typeof(IReadOnlyList<BalanceEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyBalances(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetMyBalancesQuery(), cancellationToken);
        return Ok(result);
    }

    /// <summary>Records a manual debt between two group members. Any group member can create one.</summary>
    [HttpPost("api/groups/{groupId:guid}/debts")]
    [ProducesResponseType(typeof(DebtDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateDebt(Guid groupId, [FromBody] CreateDebtRequest body, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new CreateDebtCommand(groupId, body.FromUserId, body.ToUserId, body.Amount, body.Reason), cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Marks a manual debt as paid. Only the payer or receiver can call this.</summary>
    [HttpPost("api/debts/{debtId:guid}/mark-paid")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkDebtPaid(Guid debtId, CancellationToken cancellationToken)
    {
        await mediator.Send(new MarkDebtPaidCommand(debtId), cancellationToken);
        return NoContent();
    }

    /// <summary>Cancels a manual debt. Only the creator can cancel it.</summary>
    [HttpDelete("api/debts/{debtId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelDebt(Guid debtId, CancellationToken cancellationToken)
    {
        await mediator.Send(new CancelDebtCommand(debtId), cancellationToken);
        return NoContent();
    }
}

public sealed record CreateDebtRequest(Guid FromUserId, Guid ToUserId, decimal Amount, string? Reason);
