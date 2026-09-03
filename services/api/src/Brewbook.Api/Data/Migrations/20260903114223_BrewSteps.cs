using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brewbook.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class BrewSteps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Steps",
                table: "brews",
                type: "jsonb",
                nullable: true);

            // Brews logged before labels existed keep their moments as plain pours.
            migrationBuilder.Sql("""
                UPDATE brews SET "Steps" = COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object('AtMs', m, 'Label', 'pour') ORDER BY m) FROM unnest("PourMarkersMs") AS m),
                    '[]'::jsonb);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Steps",
                table: "brews");
        }
    }
}
