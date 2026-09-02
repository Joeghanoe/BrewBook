using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brewbook.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Roasters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RoasterId",
                table: "beans",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "roasters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NormalisedName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    GooglePlaceId = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    FormattedAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Lat = table.Column<double>(type: "double precision", nullable: true),
                    Lng = table.Column<double>(type: "double precision", nullable: true),
                    Website = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roasters", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_beans_RoasterId",
                table: "beans",
                column: "RoasterId");

            migrationBuilder.CreateIndex(
                name: "IX_roasters_NormalisedName",
                table: "roasters",
                column: "NormalisedName",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_beans_roasters_RoasterId",
                table: "beans",
                column: "RoasterId",
                principalTable: "roasters",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_beans_roasters_RoasterId",
                table: "beans");

            migrationBuilder.DropTable(
                name: "roasters");

            migrationBuilder.DropIndex(
                name: "IX_beans_RoasterId",
                table: "beans");

            migrationBuilder.DropColumn(
                name: "RoasterId",
                table: "beans");
        }
    }
}
