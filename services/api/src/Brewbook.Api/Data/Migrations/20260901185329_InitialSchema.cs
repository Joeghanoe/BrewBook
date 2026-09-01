using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brewbook.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "beans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Roaster = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Origin = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Process = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RoastDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Producer = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Varietal = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Altitude = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RoastLevel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DeclaredNotes = table.Column<List<string>>(type: "text[]", nullable: false),
                    Archived = table.Column<bool>(type: "boolean", nullable: false),
                    LabelScanId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    LabelScannedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_beans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_beans_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "brews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    BeanId = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    Grind = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    DoseG = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    YieldG = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    TempC = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    Blooms = table.Column<int>(type: "integer", nullable: false),
                    DurationMs = table.Column<int>(type: "integer", nullable: false),
                    PourMarkersMs = table.Column<List<int>>(type: "integer[]", nullable: false),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    Defects = table.Column<List<string>>(type: "text[]", nullable: false),
                    BrewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_brews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_brews_beans_BeanId",
                        column: x => x.BeanId,
                        principalTable: "beans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_brews_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "flavour_tags",
                columns: table => new
                {
                    BrewId = table.Column<Guid>(type: "uuid", nullable: false),
                    Flavour = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Polarity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_flavour_tags", x => new { x.BrewId, x.Flavour });
                    table.ForeignKey(
                        name: "FK_flavour_tags_brews_BrewId",
                        column: x => x.BrewId,
                        principalTable: "brews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_beans_UserId_Archived",
                table: "beans",
                columns: new[] { "UserId", "Archived" });

            migrationBuilder.CreateIndex(
                name: "IX_brews_BeanId_Number",
                table: "brews",
                columns: new[] { "BeanId", "Number" });

            migrationBuilder.CreateIndex(
                name: "IX_brews_UserId_Number",
                table: "brews",
                columns: new[] { "UserId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                table: "users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "flavour_tags");

            migrationBuilder.DropTable(
                name: "brews");

            migrationBuilder.DropTable(
                name: "beans");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
