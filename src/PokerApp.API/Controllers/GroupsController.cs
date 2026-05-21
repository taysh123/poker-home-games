using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Features.Groups.Commands.CreateGroup;
using PokerApp.Application.Features.Groups.Commands.GenerateGroupInviteLink;
using PokerApp.Application.Features.Groups.Commands.InviteUser;
using PokerApp.Application.Features.Groups.Commands.DeleteGroup;
using PokerApp.Application.Features.Groups.Commands.JoinGroupByInviteLink;
using PokerApp.Application.Features.Groups.Commands.LeaveGroup;
using PokerApp.Application.Features.Groups.Commands.RemoveMember;
using PokerApp.Application.Features.Groups.Commands.UpdateGroup;
using PokerApp.Application.Features.Groups.Queries.GetGroupById;
using PokerApp.Application.Features.Groups.Queries.GetGroupActivity;
using PokerApp.Application.Features.Groups.Queries.GetGroupLeaderboard;
using PokerApp.Application.Features.Groups.Queries.GetGroupMembers;
using PokerApp.Application.Features.Groups.Queries.GetCrossGroupActivity;
using PokerApp.Application.Features.Groups.Queries.GetGroupRivals;
using PokerApp.Application.Features.Groups.Queries.GetMyGroups;

namespace PokerApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/groups")]
public class GroupsController(IMediator mediator) : ControllerBase
{
    /// <summary>Creates a new private group. The caller becomes the owner.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(CreateGroupResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateGroup(
        [FromBody] CreateGroupCommand command,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetGroupById), new { id = response.Id }, response);
    }

    /// <summary>Returns all groups the authenticated user belongs to.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MyGroupDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyGroups(CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetMyGroupsQuery(), cancellationToken);
        return Ok(response);
    }

    /// <summary>Returns the 10 most recent activity events across all groups the caller belongs to.</summary>
    [HttpGet("activity")]
    [ProducesResponseType(typeof(List<CrossGroupActivityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetCrossGroupActivity(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetCrossGroupActivityQuery(), cancellationToken);
        return Ok(result);
    }

    /// <summary>Returns group details. Only members can view.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(GetGroupByIdResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGroupById(Guid id, CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetGroupByIdQuery(id), cancellationToken);
        return Ok(response);
    }

    /// <summary>Updates group name/description. Requires Admin or Owner role.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(UpdateGroupResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateGroup(
        Guid id,
        [FromBody] UpdateGroupRequest body,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new UpdateGroupCommand(id, body.Name, body.Description), cancellationToken);
        return Ok(response);
    }

    /// <summary>Returns all members of the group. Only members can view.</summary>
    [HttpGet("{id:guid}/members")]
    [ProducesResponseType(typeof(IReadOnlyList<GroupMemberDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGroupMembers(Guid id, CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetGroupMembersQuery(id), cancellationToken);
        return Ok(response);
    }

    /// <summary>Invites a user to the group by username. Requires Admin or Owner role.</summary>
    [HttpPost("{id:guid}/invitations")]
    [ProducesResponseType(typeof(InviteUserToGroupResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> InviteUser(
        Guid id,
        [FromBody] InviteUserRequest body,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new InviteUserToGroupCommand(id, body.Username), cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>Removes a member from the group. Requires Admin or Owner role.</summary>
    [HttpDelete("{id:guid}/members/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId, CancellationToken cancellationToken)
    {
        await mediator.Send(new RemoveMemberCommand(id, userId), cancellationToken);
        return NoContent();
    }

    /// <summary>Returns the 50 most recent activity events for the group.</summary>
    [HttpGet("{id:guid}/activity")]
    [ProducesResponseType(typeof(List<ActivityLogDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetGroupActivity(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetGroupActivityQuery(id), cancellationToken);
        return Ok(result);
    }

    /// <summary>Returns lifetime P&L leaderboard for all registered players in the group (finished sessions only).</summary>
    [HttpGet("{id:guid}/leaderboard")]
    [ProducesResponseType(typeof(List<PlayerLeaderboardEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGroupLeaderboard(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetGroupLeaderboardQuery(id), cancellationToken);
        return Ok(result);
    }

    /// <summary>Returns the top 5 most-played rivalries in the group (pairs with most sessions together).</summary>
    [HttpGet("{id:guid}/rivals")]
    [ProducesResponseType(typeof(List<GroupRivalryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetGroupRivals(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetGroupRivalsQuery(id), cancellationToken);
        return Ok(result);
    }

    /// <summary>Permanently deletes the group. Only the group owner can do this.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteGroup(Guid id, CancellationToken cancellationToken)
    {
        await mediator.Send(new DeleteGroupCommand(id), cancellationToken);
        return NoContent();
    }

    /// <summary>Generates (or regenerates) a shareable group invite link. Requires Admin or Owner role.</summary>
    [HttpPost("{id:guid}/invite-link")]
    [ProducesResponseType(typeof(GenerateGroupInviteLinkResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateGroupInviteLink(Guid id, CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GenerateGroupInviteLinkCommand(id), cancellationToken);
        return Ok(response);
    }

    /// <summary>Joins a group via an invite link token. Any authenticated user.</summary>
    [HttpPost("join/{token}")]
    [ProducesResponseType(typeof(JoinGroupByInviteLinkResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> JoinGroupByInviteLink(string token, CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new JoinGroupByInviteLinkCommand(token), cancellationToken);
        return Ok(response);
    }

    /// <summary>Leaves the group. The group owner cannot leave.</summary>
    [HttpDelete("{id:guid}/members/me")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> LeaveGroup(Guid id, CancellationToken cancellationToken)
    {
        await mediator.Send(new LeaveGroupCommand(id), cancellationToken);
        return NoContent();
    }
}

public sealed record UpdateGroupRequest(string Name, string? Description);
public sealed record InviteUserRequest(string Username);
