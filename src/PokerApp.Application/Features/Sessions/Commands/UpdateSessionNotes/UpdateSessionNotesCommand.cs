using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.UpdateSessionNotes;

public sealed record UpdateSessionNotesCommand(Guid SessionId, string? Notes) : IRequest;
