using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.AddHandRecord;

public sealed record AddHandRecordCommand(
    Guid SessionId,
    string WinnerName,
    decimal PotAmount,
    string? Note) : IRequest<HandRecordResponse>;

public sealed record HandRecordResponse(Guid Id, Guid SessionId, string WinnerName, decimal PotAmount, string? Note, DateTime CreatedAt);
