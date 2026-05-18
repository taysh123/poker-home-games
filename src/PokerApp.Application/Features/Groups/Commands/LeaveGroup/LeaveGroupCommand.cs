using MediatR;

namespace PokerApp.Application.Features.Groups.Commands.LeaveGroup;

public sealed record LeaveGroupCommand(Guid GroupId) : IRequest;
