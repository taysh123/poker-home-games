using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

public class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public Guid UserId
    {
        get
        {
            var value = Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            // Fail closed: a missing/unparseable subject claim must NOT collapse to
            // Guid.Empty (which would silently operate as the all-zero "user").
            return Guid.TryParse(value, out var id)
                ? id
                : throw new UnauthorizedException("No authenticated user.");
        }
    }

    public string? Email => Principal?.FindFirstValue(ClaimTypes.Email);

    public string? Username => Principal?.FindFirstValue(ClaimTypes.Name);

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;
}
