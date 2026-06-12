using MediatR;

namespace PokerApp.Application.Features.Users.Commands.RegisterDeviceToken;

public sealed record RegisterDeviceTokenCommand(string Token, string Platform) : IRequest;
