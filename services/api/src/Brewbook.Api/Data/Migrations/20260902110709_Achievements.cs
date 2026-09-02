using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brewbook.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Achievements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "achievements",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UnlockedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    BrewId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_achievements", x => new { x.UserId, x.Key });
                    table.ForeignKey(
                        name: "FK_achievements_brews_BrewId",
                        column: x => x.BrewId,
                        principalTable: "brews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_achievements_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_achievements_BrewId",
                table: "achievements",
                column: "BrewId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "achievements");
        }
    }
}
