using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Features.Sync.Commands;
using PokerApp.Application.Features.Sync.Queries;

namespace PokerApp.API.Controllers;

/// <summary>
/// Premium Cloud Sync: a server-authoritative, per-user, per-namespace opaque blob store. Thin —
/// userId comes from the JWT (never the body); MediatR handlers enforce premium + scoping + concurrency.
/// </summary>
[ApiController]
[Route("api/sync")]
[Authorize]
public class SyncController(IMediator mediator) : ControllerBase
{
    /// <summary>Fetch the caller's blob for a namespace. 204 when nothing has been synced yet.</summary>
    [HttpGet("{ns}")]
    [ProducesResponseType(typeof(SyncBlobDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Get(string ns, CancellationToken cancellationToken)
    {
        var blob = await mediator.Send(new GetSyncBlobQuery(ns), cancellationToken);
        return blob is null ? NoContent() : Ok(blob);
    }

    /// <summary>Upsert the caller's blob for a namespace. Stale baseVersion ⇒ 409 Conflict.</summary>
    [HttpPut("{ns}")]
    [ProducesResponseType(typeof(PutSyncBlobResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Put(string ns, [FromBody] PutSyncBlobRequest? body, CancellationToken cancellationToken)
        => Ok(await mediator.Send(new PutSyncBlobCommand(ns, body?.Payload!, body?.BaseVersion), cancellationToken));
}

/// <summary>PUT body: the opaque payload + the optional version the client based its edit on.</summary>
public sealed record PutSyncBlobRequest(string Payload, int? BaseVersion);
