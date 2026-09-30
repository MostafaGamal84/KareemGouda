using API.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace API.Migrations;

[DbContext(typeof(DataContext))]
[Migration("20260929120000_AddExplanationTiming")]
public class AddExplanationTiming : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "ShowExplanationAfterEachAnswer", table: "Quizzes",
            type: "bit", nullable: false, defaultValue: false);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "ShowExplanationAfterEachAnswer", table: "Quizzes");
    }
}
