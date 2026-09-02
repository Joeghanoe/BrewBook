using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brewbook.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class FriendsWishesAndBagWeight : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ShareRatedByDefault",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPrivate",
                table: "brews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ArchivePromptedAt",
                table: "beans",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WeightG",
                table: "beans",
                type: "numeric(7,1)",
                precision: 7,
                scale: 1,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "friend_invites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FromUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ToEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AcceptedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_friend_invites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_friend_invites_users_FromUserId",
                        column: x => x.FromUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "friendships",
                columns: table => new
                {
                    LowUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    HighUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_friendships", x => new { x.LowUserId, x.HighUserId });
                    table.ForeignKey(
                        name: "FK_friendships_users_HighUserId",
                        column: x => x.HighUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_friendships_users_LowUserId",
                        column: x => x.LowUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "roaster_wishes",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoasterId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roaster_wishes", x => new { x.UserId, x.RoasterId });
                    table.ForeignKey(
                        name: "FK_roaster_wishes_roasters_RoasterId",
                        column: x => x.RoasterId,
                        principalTable: "roasters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_roaster_wishes_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_friend_invites_FromUserId",
                table: "friend_invites",
                column: "FromUserId");

            migrationBuilder.CreateIndex(
                name: "IX_friend_invites_ToEmail",
                table: "friend_invites",
                column: "ToEmail");

            migrationBuilder.CreateIndex(
                name: "IX_friend_invites_Token",
                table: "friend_invites",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_friendships_HighUserId",
                table: "friendships",
                column: "HighUserId");

            migrationBuilder.CreateIndex(
                name: "IX_roaster_wishes_RoasterId",
                table: "roaster_wishes",
                column: "RoasterId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "friend_invites");

            migrationBuilder.DropTable(
                name: "friendships");

            migrationBuilder.DropTable(
                name: "roaster_wishes");

            migrationBuilder.DropColumn(
                name: "ShareRatedByDefault",
                table: "users");

            migrationBuilder.DropColumn(
                name: "IsPrivate",
                table: "brews");

            migrationBuilder.DropColumn(
                name: "ArchivePromptedAt",
                table: "beans");

            migrationBuilder.DropColumn(
                name: "WeightG",
                table: "beans");
        }
    }
}
