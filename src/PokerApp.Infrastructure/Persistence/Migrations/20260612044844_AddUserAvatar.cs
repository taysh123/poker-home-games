using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PokerApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAvatar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvatarColor",
                table: "Users",
                type: "character varying(7)",
                maxLength: 7,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AvatarEmoji",
                table: "Users",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AvatarColor",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AvatarEmoji",
                table: "Users");
        }
    }
}
