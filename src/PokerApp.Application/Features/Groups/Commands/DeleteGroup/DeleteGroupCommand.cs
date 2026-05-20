using MediatR;

namespace PokerApp.Application.Features.Groups.Commands.DeleteGroup;

public sealed record DeleteGroupCommand(Guid GroupId) : IRequest;
