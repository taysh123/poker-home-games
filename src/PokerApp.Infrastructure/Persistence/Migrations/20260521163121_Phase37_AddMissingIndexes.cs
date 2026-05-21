using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PokerApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase37_AddMissingIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SessionPlayers_UserId",
                table: "SessionPlayers");

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_CreatorId",
                table: "Sessions",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_SessionPlayers_UserId",
                table: "SessionPlayers",
                column: "UserId",
                filter: "\"UserId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Sessions_CreatorId",
                table: "Sessions");

            migrationBuilder.DropIndex(
                name: "IX_SessionPlayers_UserId",
                table: "SessionPlayers");

            migrationBuilder.CreateIndex(
                name: "IX_SessionPlayers_UserId",
                table: "SessionPlayers",
                column: "UserId");
        }
    }
}
