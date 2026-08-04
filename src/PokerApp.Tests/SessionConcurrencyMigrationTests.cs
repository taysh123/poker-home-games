using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
using PokerApp.Infrastructure.Persistence.Migrations;

namespace PokerApp.Tests;

/// <summary>
/// The migration that carries the concurrency token, tested as a MIGRATION rather than through the
/// model.
///
/// Why this exists: every other suite builds its schema with `Database.EnsureCreated()`, which
/// derives DDL from the MODEL — so the migration file is never executed by any test, and deleting
/// the body of `Up()` leaves the entire suite green (verified: 275/275 with both AddColumn calls
/// removed). That silence is expensive here. `Session.Version` is a mapped scalar, so EF puts it in
/// the SELECT list of every Session materialisation — not just in UPDATE WHERE clauses. If the
/// column is missing in production, it is not the concurrency guard that degrades: EVERY endpoint
/// that reads a Session fails outright (`42703: column s.Version does not exist`) — session detail,
/// start, end, buy-in, rename, join. A money-path guard whose migration nothing can verify is the
/// shape this pins shut.
///
/// This asserts the operations the migration emits, which needs no database and no container. It
/// deliberately does NOT assert provider SQL — that is the migration runner's job, not ours.
/// </summary>
public sealed class SessionConcurrencyMigrationTests
{
    private static IReadOnlyList<MigrationOperation> UpOperations()
    {
        var migration = new SessionConcurrencyToken();
        var builder = new MigrationBuilder(activeProvider: null);
        // The Up(MigrationBuilder) overload is protected; migrations expose their operations
        // through the public UpOperations property once built.
        typeof(SessionConcurrencyToken)
            .GetMethod("Up", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!
            .Invoke(migration, [builder]);
        return builder.Operations;
    }

    [Theory]
    [InlineData("Sessions")]
    [InlineData("SessionInviteTokens")]
    public void Adds_a_non_nullable_int_Version_column_defaulting_to_zero(string table)
    {
        // DEFAULT 0 is what makes this safe to run against a table that already has production rows:
        // existing sessions adopt 0 and the first End() bumps them to 1. NOT NULL without a default
        // would fail the ALTER outright on a non-empty table.
        var column = Assert.Single(
            UpOperations().OfType<AddColumnOperation>(),
            op => op.Table == table && op.Name == "Version");

        Assert.Equal(typeof(int), column.ClrType);
        Assert.False(column.IsNullable);
        Assert.Equal(0, column.DefaultValue);
    }

    [Fact]
    public void Adds_nothing_else_and_drops_nothing()
    {
        // Additive-only is the safety claim made in the PR: this runs against live production data,
        // so any Drop/Alter/Rename sneaking in later must fail here rather than at deploy time.
        var ops = UpOperations();

        Assert.Equal(2, ops.Count);
        Assert.All(ops, op => Assert.IsType<AddColumnOperation>(op));
    }
}
