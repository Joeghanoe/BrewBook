using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brewbook.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OnboardingSeen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "OnboardedAt",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OnboardedAt",
                table: "users");
        }
    }
}
