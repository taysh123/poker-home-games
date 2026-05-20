using MediatR;

namespace PokerApp.Application.Features.Sessions.Commands.UpdateSessionName;

public sealed record UpdateSessionNameCommand(Guid SessionId, string Name) : IRequest;
