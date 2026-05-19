using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PokerApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase13_RemoveBlindsAddFinalStacksGuestLinking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BigBlind",
                table: "Sessions");

            migrationBuilder.DropColumn(
                name: "SmallBlind",
                table: "Sessions");

            migrationBuilder.AddColumn<Guid>(
                name: "LinkedUserId",
                table: "SessionPlayers",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SessionPlayers_LinkedUserId",
                table: "SessionPlayers",
                column: "LinkedUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_SessionPlayers_Users_LinkedUserId",
                table: "SessionPlayers",
                column: "LinkedUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SessionPlayers_Users_LinkedUserId",
                table: "SessionPlayers");

            migrationBuilder.DropIndex(
                name: "IX_SessionPlayers_LinkedUserId",
                table: "SessionPlayers");

            migrationBuilder.DropColumn(
                name: "LinkedUserId",
                table: "SessionPlayers");

            migrationBuilder.AddColumn<decimal>(
                name: "BigBlind",
                table: "Sessions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SmallBlind",
                table: "Sessions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }
    }
}
