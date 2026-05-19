namespace PokerApp.Application.Features.Auth.Commands.UpdateProfile;

public sealed record UpdateProfileResponse(Guid UserId, string Username, string Email);
