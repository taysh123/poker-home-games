using MediatR;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Entitlements.Queries;

public sealed record GetEntitlementQuery : IRequest<EntitlementDto>;

public sealed class GetEntitlementQueryHandler(
    IEntitlementService entitlements,
    ICurrentUserService currentUser) : IRequestHandler<GetEntitlementQuery, EntitlementDto>
{
    public Task<EntitlementDto> Handle(GetEntitlementQuery request, CancellationToken cancellationToken) =>
        entitlements.GetAsync(currentUser.UserId, cancellationToken);
}
