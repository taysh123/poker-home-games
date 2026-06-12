using MediatR;

namespace PokerApp.Application.Features.Auth.Commands.UpdateProfile;

public sealed record UpdateProfileCommand(
    string? Username,
    string? Email,
    string? AvatarEmoji = null,
    string? AvatarColor = null) : IRequest<UpdateProfileResponse>;
