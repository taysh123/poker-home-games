namespace PokerApp.Application.Features.Auth.Queries.GetCurrentUser;

public sealed record GetCurrentUserResponse(
    Guid Id,
    string Username,
    string Email,
    string AppRole,
    DateTime MemberSince);
