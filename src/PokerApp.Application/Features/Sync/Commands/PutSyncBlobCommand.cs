using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Sync.Commands;

/// <summary>Result of a successful upsert: the new server-authoritative version + when it was written.</summary>
public sealed record PutSyncBlobResult(int Version, DateTime UpdatedAt);

/// <summary>
/// Upsert the caller's blob for a namespace. <paramref name="BaseVersion"/> (optional) is the version the
/// client believed it was editing — used for optimistic concurrency (a stale value ⇒ 409 Conflict).
/// </summary>
public sealed record PutSyncBlobCommand(string Namespace, string Payload, int? BaseVersion = null)
    : IRequest<PutSyncBlobResult>;

public sealed class PutSyncBlobCommandValidator : AbstractValidator<PutSyncBlobCommand>
{
    public PutSyncBlobCommandValidator()
    {
        // Cheap field bounds for the API path. The security-critical checks (premium gate, namespace
        // allow-list, 1 MB size, concurrency) are enforced in the handler so they hold even off-pipeline.
        RuleFor(x => x.Namespace).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Payload).NotNull();
        RuleFor(x => x.BaseVersion).GreaterThan(0).When(x => x.BaseVersion.HasValue);
    }
}

/// <summary>
/// Server-authoritative write. Premium-gated, user-scoped, allow-list + size bounded, with optimistic
/// concurrency so a stale client cannot silently clobber a newer blob (no lost updates).
/// </summary>
public sealed class PutSyncBlobCommandHandler(
    IApplicationDbContext db,
    IEntitlementService entitlements,
    ICurrentUserService currentUser) : IRequestHandler<PutSyncBlobCommand, PutSyncBlobResult>
{
    public async Task<PutSyncBlobResult> Handle(PutSyncBlobCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId; // [Authorize] guarantees a verified account

        // 1) Gate first — a free account has no business here, whatever the payload looks like.
        await SyncContract.EnsurePremiumAsync(entitlements, userId, cancellationToken);
        // 2) Reject abuse before touching the DB.
        SyncContract.ValidateNamespace(request.Namespace);
        SyncContract.ValidatePayload(request.Payload);

        // 3) Locate THIS user's row for the namespace (scoping is part of the key predicate).
        var row = await db.CloudBackups.FirstOrDefaultAsync(
            b => b.UserId == userId && b.Namespace == request.Namespace,
            cancellationToken);

        if (row is null)
        {
            // First write for (user, namespace) ⇒ create at version 1. BaseVersion is irrelevant here.
            row = CloudBackup.Create(userId, request.Namespace, request.Payload);
            db.CloudBackups.Add(row);
        }
        else
        {
            // Optimistic concurrency: a provided-but-stale BaseVersion means the client edited an old
            // copy — reject rather than overwrite the newer stored blob. A null BaseVersion = last-write-wins.
            if (request.BaseVersion.HasValue && request.BaseVersion.Value != row.Version)
                throw new ConflictException(
                    $"Version conflict: your base v{request.BaseVersion} is stale (server is at v{row.Version}).");

            row.Apply(request.Payload);
        }

        await db.SaveChangesAsync(cancellationToken);
        return new PutSyncBlobResult(row.Version, row.UpdatedAt);
    }
}
