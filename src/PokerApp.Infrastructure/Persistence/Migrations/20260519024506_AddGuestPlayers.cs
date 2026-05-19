using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PokerApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGuestPlayers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SessionPlayers_SessionId_UserId",
                table: "SessionPlayers");

            migrationBuilder.DropIndex(
                name: "IX_CashOuts_SessionId_UserId",
                table: "CashOuts");

            migrationBuilder.DropIndex(
                name: "IX_BuyIns_SessionId_UserId",
                table: "BuyIns");

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "SessionPlayers",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "GuestName",
                table: "SessionPlayers",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "CashOuts",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "SessionPlayerId",
                table: "CashOuts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "BuyIns",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "SessionPlayerId",
                table: "BuyIns",
                type: "uuid",
                nullable: true);

            // Backfill: link existing BuyIns/CashOuts to their SessionPlayer rows via UserId
            migrationBuilder.Sql(@"UPDATE ""BuyIns"" b SET ""SessionPlayerId"" = sp.""Id"" FROM ""SessionPlayers"" sp WHERE sp.""SessionId"" = b.""SessionId"" AND sp.""UserId"" = b.""UserId"";");
            migrationBuilder.Sql(@"UPDATE ""CashOuts"" c SET ""SessionPlayerId"" = sp.""Id"" FROM ""SessionPlayers"" sp WHERE sp.""SessionId"" = c.""SessionId"" AND sp.""UserId"" = c.""UserId"";");

            migrationBuilder.CreateIndex(
                name: "IX_SessionPlayers_SessionId_GuestName",
                table: "SessionPlayers",
                columns: new[] { "SessionId", "GuestName" },
                unique: true,
                filter: "\"GuestName\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SessionPlayers_SessionId_UserId",
                table: "SessionPlayers",
                columns: new[] { "SessionId", "UserId" },
                unique: true,
                filter: "\"UserId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CashOuts_SessionId_SessionPlayerId",
                table: "CashOuts",
                columns: new[] { "SessionId", "SessionPlayerId" });

            migrationBuilder.CreateIndex(
                name: "IX_CashOuts_SessionPlayerId",
                table: "CashOuts",
                column: "SessionPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_BuyIns_SessionId_SessionPlayerId",
                table: "BuyIns",
                columns: new[] { "SessionId", "SessionPlayerId" });

            migrationBuilder.CreateIndex(
                name: "IX_BuyIns_SessionPlayerId",
                table: "BuyIns",
                column: "SessionPlayerId");

            migrationBuilder.AddForeignKey(
                name: "FK_BuyIns_SessionPlayers_SessionPlayerId",
                table: "BuyIns",
                column: "SessionPlayerId",
                principalTable: "SessionPlayers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_CashOuts_SessionPlayers_SessionPlayerId",
                table: "CashOuts",
                column: "SessionPlayerId",
                principalTable: "SessionPlayers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BuyIns_SessionPlayers_SessionPlayerId",
                table: "BuyIns");

            migrationBuilder.DropForeignKey(
                name: "FK_CashOuts_SessionPlayers_SessionPlayerId",
                table: "CashOuts");

            migrationBuilder.DropIndex(
                name: "IX_SessionPlayers_SessionId_GuestName",
                table: "SessionPlayers");

            migrationBuilder.DropIndex(
                name: "IX_SessionPlayers_SessionId_UserId",
                table: "SessionPlayers");

            migrationBuilder.DropIndex(
                name: "IX_CashOuts_SessionId_SessionPlayerId",
                table: "CashOuts");

            migrationBuilder.DropIndex(
                name: "IX_CashOuts_SessionPlayerId",
                table: "CashOuts");

            migrationBuilder.DropIndex(
                name: "IX_BuyIns_SessionId_SessionPlayerId",
                table: "BuyIns");

            migrationBuilder.DropIndex(
                name: "IX_BuyIns_SessionPlayerId",
                table: "BuyIns");

            migrationBuilder.DropColumn(
                name: "GuestName",
                table: "SessionPlayers");

            migrationBuilder.DropColumn(
                name: "SessionPlayerId",
                table: "CashOuts");

            migrationBuilder.DropColumn(
                name: "SessionPlayerId",
                table: "BuyIns");

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "SessionPlayers",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "CashOuts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "BuyIns",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SessionPlayers_SessionId_UserId",
                table: "SessionPlayers",
                columns: new[] { "SessionId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CashOuts_SessionId_UserId",
                table: "CashOuts",
                columns: new[] { "SessionId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_BuyIns_SessionId_UserId",
                table: "BuyIns",
                columns: new[] { "SessionId", "UserId" });
        }
    }
}
