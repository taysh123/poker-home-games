using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Sync.Queries;

/// <summary>The stored blob for a (caller, namespace), or null when nothing has been synced yet.</summary>
public sealed record SyncBlobDto(string Payload, int Version, DateTime UpdatedAt);

public sealed record GetSyncBlobQuery(string Namespace) : IRequest<SyncBlobDto?>;

/// <summary>
/// Reads the caller's blob for a namespace. Premium-gated and strictly user-scoped — the query filters
/// on the authenticated userId so one account can never read another's row.
/// </summary>
public sealed class GetSyncBlobQueryHandler(
    IApplicationDbContext db,
    IEntitlementService entitlements,
    ICurrentUserService currentUser) : IRequestHandler<GetSyncBlobQuery, SyncBlobDto?>
{
    public async Task<SyncBlobDto?> Handle(GetSyncBlobQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId; // [Authorize] guarantees a verified account

        // Gate first: a non-premium caller must not even learn whether a namespace / blob exists.
        await SyncContract.EnsurePremiumAsync(entitlements, userId, cancellationToken);
        SyncContract.ValidateNamespace(request.Namespace);

        var row = await db.CloudBackups
            .AsNoTracking()
            .FirstOrDefaultAsync(
                b => b.UserId == userId && b.Namespace == request.Namespace,
                cancellationToken);

        return row is null ? null : new SyncBlobDto(row.Payload, row.Version, row.UpdatedAt);
    }
}
