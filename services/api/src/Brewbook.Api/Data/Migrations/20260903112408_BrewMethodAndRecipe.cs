using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brewbook.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class BrewMethodAndRecipe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "Method",
                table: "brews",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<int>(
                name: "PreInfusionS",
                table: "brews",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TargetMs",
                table: "brews",
                type: "integer",
                nullable: false,
                defaultValue: 150000);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Method",
                table: "brews");

            migrationBuilder.DropColumn(
                name: "PreInfusionS",
                table: "brews");

            migrationBuilder.DropColumn(
                name: "TargetMs",
                table: "brews");
        }
    }
}
