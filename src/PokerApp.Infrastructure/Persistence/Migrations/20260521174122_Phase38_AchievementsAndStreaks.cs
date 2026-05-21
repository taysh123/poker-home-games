using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace PokerApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase38_AchievementsAndStreaks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Achievements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    IconKey = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Rarity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Achievements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserAchievements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AchievementKey = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    UnlockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserAchievements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserAchievements_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Achievements",
                columns: new[] { "Id", "Description", "IconKey", "Key", "Name", "Rarity" },
                values: new object[,]
                {
                    { new Guid("10000000-0000-0000-0000-000000000001"), "Complete your first session.", "trophy-outline", "first_session", "First Blood", 0 },
                    { new Guid("10000000-0000-0000-0000-000000000002"), "Play 10 sessions.", "layers-outline", "ten_sessions", "Grinder", 0 },
                    { new Guid("10000000-0000-0000-0000-000000000003"), "Play 50 sessions.", "medal-outline", "fifty_sessions", "Veteran", 1 },
                    { new Guid("10000000-0000-0000-0000-000000000004"), "Win your first session.", "thumbs-up-outline", "first_win", "Winner", 0 },
                    { new Guid("10000000-0000-0000-0000-000000000005"), "Win 5 sessions in a row.", "flame-outline", "five_win_streak", "Hot Streak", 1 },
                    { new Guid("10000000-0000-0000-0000-000000000006"), "Reach ₪100 in total profit.", "trending-up-outline", "profit_100", "In the Black", 0 },
                    { new Guid("10000000-0000-0000-0000-000000000007"), "Reach ₪1,000 in total profit.", "cash-outline", "profit_1000", "High Roller", 2 },
                    { new Guid("10000000-0000-0000-0000-000000000008"), "Lose big, then win the very next session.", "refresh-outline", "comeback", "Comeback Kid", 1 },
                    { new Guid("10000000-0000-0000-0000-000000000009"), "Play a session lasting 4+ hours.", "time-outline", "marathon", "Long Night", 0 },
                    { new Guid("10000000-0000-0000-0000-00000000000a"), "Rebuy 3+ times in a single session.", "repeat-outline", "triple_rebuy", "Reload", 0 },
                    { new Guid("10000000-0000-0000-0000-00000000000b"), "Cash out exactly even.", "remove-outline", "cash_out_even", "Breakeven Pro", 0 },
                    { new Guid("10000000-0000-0000-0000-00000000000c"), "Log 10 hand records.", "document-text-outline", "hand_historian", "Hand Tracker", 0 },
                    { new Guid("10000000-0000-0000-0000-00000000000d"), "Join or create your first group.", "people-outline", "first_group", "Social Poker", 0 },
                    { new Guid("10000000-0000-0000-0000-00000000000e"), "Reach ₪5,000 in total profit.", "star-outline", "profit_5000", "Table Captain", 3 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Achievements_Key",
                table: "Achievements",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserAchievements_UserId",
                table: "UserAchievements",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserAchievements_UserId_Key",
                table: "UserAchievements",
                columns: new[] { "UserId", "AchievementKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Achievements");

            migrationBuilder.DropTable(
                name: "UserAchievements");
        }
    }
}
