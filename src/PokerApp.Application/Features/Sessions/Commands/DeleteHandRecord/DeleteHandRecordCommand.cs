using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.DeleteHandRecord;

public sealed record DeleteHandRecordCommand(Guid SessionId, Guid HandRecordId) : IRequest;
