using MediatR;

namespace PokerApp.Application.Features.Auth.Commands.DeleteAccount;

public sealed record DeleteAccountCommand : IRequest<Unit>;
