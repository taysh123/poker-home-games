using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Features.Groups.Commands.AcceptInvitation;
using PokerApp.Application.Features.Groups.Commands.DeclineInvitation;
using PokerApp.Application.Features.Groups.Queries.GetMyInvitations;

namespace PokerApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/invitations")]
public class InvitationsController(IMediator mediator) : ControllerBase
{
    /// <summary>Returns all pending invitations for the authenticated user.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PendingInvitationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyInvitations(CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetMyInvitationsQuery(), cancellationToken);
        return Ok(response);
    }

    /// <summary>Accepts a pending invitation and joins the group.</summary>
    [HttpPost("{id:guid}/accept")]
    [ProducesResponseType(typeof(AcceptInvitationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AcceptInvitation(Guid id, CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new AcceptInvitationCommand(id), cancellationToken);
        return Ok(response);
    }

    /// <summary>Declines a pending invitation.</summary>
    [HttpPost("{id:guid}/decline")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeclineInvitation(Guid id, CancellationToken cancellationToken)
    {
        await mediator.Send(new DeclineInvitationCommand(id), cancellationToken);
        return NoContent();
    }
}
