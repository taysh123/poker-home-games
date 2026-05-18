using MediatR;

namespace PokerApp.Application.Features.Groups.Commands.DeclineInvitation;

public sealed record DeclineInvitationCommand(Guid InvitationId) : IRequest;
