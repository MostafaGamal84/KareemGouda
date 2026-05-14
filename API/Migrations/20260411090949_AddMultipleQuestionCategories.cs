using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations
{
    /// <inheritdoc />
    public partial class AddMultipleQuestionCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QuestionCategoryAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    QuestionId = table.Column<int>(type: "int", nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionCategoryAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionCategoryAssignments_QuestionCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "QuestionCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuestionCategoryAssignments_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionCategoryAssignments_CategoryId",
                table: "QuestionCategoryAssignments",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionCategoryAssignments_QuestionId_CategoryId",
                table: "QuestionCategoryAssignments",
                columns: new[] { "QuestionId", "CategoryId" },
                unique: true);

            migrationBuilder.Sql(
                """
                INSERT INTO QuestionCategoryAssignments (QuestionId, CategoryId, IsDeleted)
                SELECT q.Id, q.CategoryId, 0
                FROM Questions q
                INNER JOIN QuestionCategories qc ON qc.Id = q.CategoryId
                WHERE q.CategoryId IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM QuestionCategoryAssignments link
                      WHERE link.QuestionId = q.Id
                        AND link.CategoryId = q.CategoryId
                  );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuestionCategoryAssignments");
        }
    }
}
