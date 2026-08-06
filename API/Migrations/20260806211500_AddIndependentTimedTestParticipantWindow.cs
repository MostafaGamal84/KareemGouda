using API.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations;

[DbContext(typeof(DataContext))]
[Migration("20260806211500_AddIndependentTimedTestParticipantWindow")]
public partial class AddIndependentTimedTestParticipantWindow : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTime>(
            name: "TestStartedAt",
            table: "GameParticipants",
            type: "datetime2",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "TestEndsAt",
            table: "GameParticipants",
            type: "datetime2",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "TestCompletedAt",
            table: "GameParticipants",
            type: "datetime2",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "TestStartedAt",
            table: "GameParticipants");

        migrationBuilder.DropColumn(
            name: "TestEndsAt",
            table: "GameParticipants");

        migrationBuilder.DropColumn(
            name: "TestCompletedAt",
            table: "GameParticipants");
    }
}
