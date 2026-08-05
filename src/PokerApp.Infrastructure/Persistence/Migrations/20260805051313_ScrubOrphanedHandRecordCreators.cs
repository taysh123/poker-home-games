using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PokerApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScrubOrphanedHandRecordCreators : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Makes the T0.5 privacy fix RETROACTIVE. DeleteAccountCommandHandler now scrubs
            // HandRecord.CreatedByUserId, but only from the moment it runs — every account deleted
            // BEFORE this deploys still has its exact original GUID sitting in HandRecords, which is
            // the residue audit HIGH #4 describes. The column has no FK, so nothing ever cleaned it.
            //
            // Data-only: no schema change, so this cannot break a read the way an added column can.
            // The predicate is exact — a creator id with no matching Users row can only be a deleted
            // account, since the column is written solely from the authenticated caller's id.
            // Guid.Empty rows are already scrubbed and are excluded so the statement is idempotent.
            migrationBuilder.Sql("""
                UPDATE "HandRecords"
                SET "CreatedByUserId" = '00000000-0000-0000-0000-000000000000'
                WHERE "CreatedByUserId" <> '00000000-0000-0000-0000-000000000000'
                  AND NOT EXISTS (SELECT 1 FROM "Users" u WHERE u."Id" = "HandRecords"."CreatedByUserId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Deliberately empty: the original ids are gone and cannot be reconstructed. Re-creating
            // them is neither possible nor desirable — this migration exists to destroy them.
        }
    }
}
