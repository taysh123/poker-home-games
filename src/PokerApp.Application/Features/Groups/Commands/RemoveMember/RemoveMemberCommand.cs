using MediatR;

namespace PokerApp.Application.Features.Groups.Commands.RemoveMember;

public sealed record RemoveMemberCommand(Guid GroupId, Guid UserId) : IRequest;
