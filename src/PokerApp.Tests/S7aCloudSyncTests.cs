using System;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Features.Sync.Commands;
using PokerApp.Application.Features.Sync.Queries;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Slice S7a — Cloud Sync backend. These tests gate USER DATA: they prove the server-authoritative,
/// premium-gated, user-scoped GET/PUT /api/sync/{namespace} layer cannot leak a blob across users,
/// cannot be reached by a free account, cannot silently lose a write, and rejects abuse (unknown
/// namespace / oversized payload). The handlers are exercised directly (no HTTP) exactly like
/// S6aMoneySafetyTests, so the invariants hold regardless of the controller/pipeline.
/// </summary>
public class S7aCloudSyncTests
{
    // --- helpers ---------------------------------------------------------------------------------

    private static GetSyncBlobQueryHandler Get(AppDbContext ctx, Guid uid) =>
        new(ctx, new EntitlementService(ctx), new FakeCurrentUser(uid));

    private static PutSyncBlobCommandHandler Put(AppDbContext ctx, Guid uid) =>
        new(ctx, new EntitlementService(ctx), new FakeCurrentUser(uid));

    private static PutSyncBlobCommand PutCmd(string ns, string payload, int? baseVersion = null) =>
        new(ns, payload, baseVersion);

    /// <summary>Grant the user a genuinely-active premium subscription (the only premium source).</summary>
    private static async Task SeedPremiumAsync(AppDbContext ctx, Guid uid)
    {
        ctx.Subscriptions.Add(Subscription.Create(uid, SubscriptionStore.Apple, "tpoker.premium.monthly",
            $"txn-{uid}", DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(20), true, false, DateTime.UtcNow));
        await ctx.SaveChangesAsync();
    }

    // --- Invariant 1: premium gate ---------------------------------------------------------------

    [Fact] // Free user's GET and PUT are denied at the SERVER (never trust the client).
    public async Task Free_user_is_denied_get_and_put()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid(); // no subscription ⇒ server computes "free"

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Get(ctx, uid).Handle(new GetSyncBlobQuery("localGames"), default));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Put(ctx, uid).Handle(PutCmd("localGames", "{\"x\":1}"), default));

        // The denied PUT must NOT have written anything.
        Assert.Equal(0, await ctx.CloudBackups.CountAsync());
    }

    [Fact] // A premium user can PUT then GET back the same blob.
    public async Task Premium_user_is_allowed_get_and_put()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        await SeedPremiumAsync(ctx, uid);

        var put = await Put(ctx, uid).Handle(PutCmd("localGames", "{\"games\":[]}"), default);
        Assert.Equal(1, put.Version);

        var got = await Get(ctx, uid).Handle(new GetSyncBlobQuery("localGames"), default);
        Assert.NotNull(got);
        Assert.Equal("{\"games\":[]}", got!.Payload);
        Assert.Equal(1, got.Version);
    }

    // --- Invariant 2: user-scoping (no cross-user contamination) ---------------------------------

    [Fact] // User A's blob is invisible to user B; A's PUT never touches B's row, and vice-versa.
    public async Task Blob_is_scoped_to_caller_and_never_leaks_across_users()
    {
        using var ctx = TestInfra.NewContext();
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        await SeedPremiumAsync(ctx, a);
        await SeedPremiumAsync(ctx, b);

        await Put(ctx, a).Handle(PutCmd("localGames", "A-SECRET"), default);

        // B reads the SAME namespace from the SAME database — must see nothing of A's.
        Assert.Null(await Get(ctx, b).Handle(new GetSyncBlobQuery("localGames"), default));

        // B writes its own; A's row is untouched (still v1 / A-SECRET), B's is independent.
        await Put(ctx, b).Handle(PutCmd("localGames", "B-SECRET"), default);

        var aRow = await Get(ctx, a).Handle(new GetSyncBlobQuery("localGames"), default);
        var bRow = await Get(ctx, b).Handle(new GetSyncBlobQuery("localGames"), default);
        Assert.Equal("A-SECRET", aRow!.Payload);
        Assert.Equal(1, aRow.Version);
        Assert.Equal("B-SECRET", bRow!.Payload);
        Assert.Equal(1, bRow.Version);

        // Exactly two physically-separate rows — one per user.
        Assert.Equal(2, await ctx.CloudBackups.CountAsync());
    }

    // --- Invariant 3: namespace isolation --------------------------------------------------------

    [Fact] // The same user's localGames and study blobs are independent rows.
    public async Task Namespaces_are_independent_rows_for_the_same_user()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        await SeedPremiumAsync(ctx, uid);

        await Put(ctx, uid).Handle(PutCmd("localGames", "GAMES"), default);
        await Put(ctx, uid).Handle(PutCmd("study", "STUDY"), default);

        // Writing study a second time must not disturb localGames.
        await Put(ctx, uid).Handle(PutCmd("study", "STUDY-2"), default);

        var games = await Get(ctx, uid).Handle(new GetSyncBlobQuery("localGames"), default);
        var study = await Get(ctx, uid).Handle(new GetSyncBlobQuery("study"), default);
        Assert.Equal("GAMES", games!.Payload);
        Assert.Equal(1, games.Version);            // untouched by the study writes
        Assert.Equal("STUDY-2", study!.Payload);
        Assert.Equal(2, study.Version);
        Assert.Equal(2, await ctx.CloudBackups.CountAsync());
    }

    // --- Invariant 4: upsert + version -----------------------------------------------------------

    [Fact] // First PUT creates (v1); second PUT (no baseVersion) updates payload + bumps to v2; GET sees latest.
    public async Task Put_creates_then_updates_incrementing_version()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        await SeedPremiumAsync(ctx, uid);

        var first = await Put(ctx, uid).Handle(PutCmd("localGames", "v1-data"), default);
        Assert.Equal(1, first.Version);

        var second = await Put(ctx, uid).Handle(PutCmd("localGames", "v2-data"), default);
        Assert.Equal(2, second.Version);

        var got = await Get(ctx, uid).Handle(new GetSyncBlobQuery("localGames"), default);
        Assert.Equal("v2-data", got!.Payload);
        Assert.Equal(2, got.Version);
        Assert.Equal(1, await ctx.CloudBackups.CountAsync()); // upsert, not a second row
    }

    // --- Invariant 5: optimistic concurrency (no lost update) ------------------------------------

    [Fact] // A stale baseVersion is rejected (409) and DOES NOT overwrite; the correct one succeeds.
    public async Task Stale_base_version_conflicts_and_does_not_overwrite()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        await SeedPremiumAsync(ctx, uid);

        await Put(ctx, uid).Handle(PutCmd("localGames", "v1"), default);                 // v1
        await Put(ctx, uid).Handle(PutCmd("localGames", "v2", baseVersion: 1), default); // v2

        // A client that still thinks it's on v1 must be rejected — its write must be lost, not the stored one.
        await Assert.ThrowsAsync<ConflictException>(() =>
            Put(ctx, uid).Handle(PutCmd("localGames", "STALE-LOST-UPDATE", baseVersion: 1), default));

        var afterConflict = await Get(ctx, uid).Handle(new GetSyncBlobQuery("localGames"), default);
        Assert.Equal("v2", afterConflict!.Payload);  // the stale write did NOT land
        Assert.Equal(2, afterConflict.Version);

        // The fresh, correct baseVersion proceeds.
        var ok = await Put(ctx, uid).Handle(PutCmd("localGames", "v3", baseVersion: 2), default);
        Assert.Equal(3, ok.Version);
    }

    // --- Invariant 6: allow-list + size bound ----------------------------------------------------

    [Fact] // An unknown namespace is rejected with BadRequest (premium user, so the gate is passed first).
    public async Task Unknown_namespace_is_bad_request()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        await SeedPremiumAsync(ctx, uid);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            Put(ctx, uid).Handle(PutCmd("hacker-namespace", "{}"), default));
        await Assert.ThrowsAsync<BadRequestException>(() =>
            Get(ctx, uid).Handle(new GetSyncBlobQuery("hacker-namespace"), default));

        Assert.Equal(0, await ctx.CloudBackups.CountAsync());
    }

    [Fact] // An oversized payload (> 1 MB) is rejected with BadRequest and never stored.
    public async Task Oversized_payload_is_bad_request()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        await SeedPremiumAsync(ctx, uid);

        var oneMbPlusOne = new string('x', (1024 * 1024) + 1); // 1 byte over the 1 MB bound (ASCII ⇒ 1 byte/char)
        Assert.True(Encoding.UTF8.GetByteCount(oneMbPlusOne) > 1024 * 1024);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            Put(ctx, uid).Handle(PutCmd("localGames", oneMbPlusOne), default));

        Assert.Equal(0, await ctx.CloudBackups.CountAsync());
    }
}
