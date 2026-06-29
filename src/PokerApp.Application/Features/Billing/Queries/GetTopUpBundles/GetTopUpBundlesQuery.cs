using MediatR;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Billing.Queries.GetTopUpBundles;

/// <summary>Lists the configured consumable AI-credit bundles for display. Empty when top-ups are off.</summary>
public sealed record GetTopUpBundlesQuery : IRequest<IReadOnlyList<TopUpBundleDto>>;

public sealed class GetTopUpBundlesQueryHandler(ITopUpCatalog catalog)
    : IRequestHandler<GetTopUpBundlesQuery, IReadOnlyList<TopUpBundleDto>>
{
    public Task<IReadOnlyList<TopUpBundleDto>> Handle(GetTopUpBundlesQuery request, CancellationToken cancellationToken)
        => Task.FromResult(catalog.Enabled ? catalog.Bundles() : (IReadOnlyList<TopUpBundleDto>)[]);
}
