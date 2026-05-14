using API.DTOs.QuizGame;
using API.Extensions;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.QuizGame;

[ApiController]
[Route("api/questions")]
public class QuestionsController : ControllerBase
{
    private readonly IQuestionService _service;

    public QuestionsController(IQuestionService service)
    {
        _service = service;
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] QuestionCreateUpdateDto dto)
    {
        try
        {
            var result = await _service.CreateAsync(dto, User.Identity?.IsAuthenticated == true ? User.GetUserId() : null);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] QuestionCreateUpdateDto dto)
    {
        try
        {
            var result = await _service.UpdateAsync(id, dto);
            return result is null ? NotFound(new { message = "Question not found" }) : Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _service.SoftDeleteAsync(id);
        return deleted ? Ok(new { message = "Question deleted" }) : NotFound(new { message = "Question not found" });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/image")]
    public async Task<IActionResult> UploadImage(int id, [FromForm] IFormFile? file)
    {
        if (file is null)
        {
            return BadRequest(new { message = "Image file is required." });
        }

        try
        {
            var imageUrl = await _service.UploadImageAsync(id, file);
            return imageUrl is null
                ? NotFound(new { message = "Question not found" })
                : Ok(new { imageUrl });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{questionId:int}/choices/{choiceId:int}/image")]
    public async Task<IActionResult> UploadChoiceImage(int questionId, int choiceId, [FromForm] IFormFile? file)
    {
        if (file is null)
        {
            return BadRequest(new { message = "Image file is required." });
        }

        try
        {
            var imageUrl = await _service.UploadChoiceImageAsync(questionId, choiceId, file);
            return imageUrl is null
                ? NotFound(new { message = "Choice not found for this question" })
                : Ok(new { imageUrl });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] QuestionQueryDto query)
    {
        var result = await _service.GetAllAsync(query);
        return Ok(result);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _service.GetByIdAsync(id);
        return result is null ? NotFound(new { message = "Question not found" }) : Ok(result);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("random-by-category")]
    public async Task<IActionResult> GetRandomQuestionsByCategory([FromBody] RandomQuestionSelectionRequest request)
    {
        if (request.CategorySelections == null || !request.CategorySelections.Any())
        {
            return BadRequest(new { message = "At least one category selection is required." });
        }

        var result = await _service.GetRandomQuestionsByCategoryAsync(request);
        return Ok(result);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("categories-with-counts")]
    public async Task<IActionResult> GetCategoriesWithCounts()
    {
        var result = await _service.GetCategoriesWithQuestionCountsAsync();
        return Ok(result.Select(c => new
        {
            c.Id,
            c.Name,
            c.Description,
            QuestionCount = c.QuestionCategoryAssignments.Count(link => !link.Question.IsDeleted)
        }));
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/duplicate")]
    public async Task<IActionResult> DuplicateQuestion(int id)
    {
        var result = await _service.DuplicateAsync(id, User.GetUserId());
        return result is null ? NotFound(new { message = "Question not found" }) : CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDelete([FromBody] List<int> ids)
    {
        if (ids is null || ids.Count == 0)
        {
            return BadRequest(new { message = "No IDs provided" });
        }

        var deleted = 0;
        foreach (var id in ids)
        {
            if (await _service.SoftDeleteAsync(id))
            {
                deleted++;
            }
        }

        return Ok(new { message = $"Deleted {deleted} questions", deletedCount = deleted });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("bulk-add-category")]
    public async Task<IActionResult> BulkAddCategory([FromBody] BulkQuestionCategoryDto dto)
    {
        if (dto.Ids is null || dto.Ids.Count == 0)
        {
            return BadRequest(new { message = "No IDs provided" });
        }

        if (string.IsNullOrWhiteSpace(dto.CategoryName))
        {
            return BadRequest(new { message = "Category name is required" });
        }

        var updated = await _service.AddCategoryToQuestionsAsync(dto.Ids, dto.CategoryName);
        var categoryName = dto.CategoryName.Trim();

        return Ok(new
        {
            message = updated > 0
                ? $"Category '{categoryName}' applied to {updated} questions"
                : $"Selected questions already use '{categoryName}'",
            updatedCount = updated,
            categoryName
        });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("bulk-remove-category")]
    public async Task<IActionResult> BulkRemoveCategory([FromBody] BulkQuestionCategoryDto dto)
    {
        if (dto.Ids is null || dto.Ids.Count == 0)
        {
            return BadRequest(new { message = "No IDs provided" });
        }

        var updated = await _service.RemoveCategoryFromQuestionsAsync(dto.Ids, dto.CategoryName);
        var targetCategory = string.IsNullOrWhiteSpace(dto.CategoryName) ? null : dto.CategoryName.Trim();

        return Ok(new
        {
            message = updated > 0
                ? targetCategory is null
                    ? $"Removed categories from {updated} questions"
                    : $"Removed category '{targetCategory}' from {updated} questions"
                : targetCategory is null
                    ? "Selected questions do not have categories"
                    : $"Selected questions do not include '{targetCategory}'",
            updatedCount = updated,
            categoryName = targetCategory
        });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("import")]
    public async Task<IActionResult> ImportQuestions([FromForm] IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Please select an Excel file to import." });
        }

        try
        {
            var result = await _service.ImportFromExcelAsync(file);
            return Ok(new { message = $"Successfully imported {result} questions." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("export")]
    public async Task<IActionResult> ExportQuestions([FromQuery] string? search, [FromQuery] int? type, [FromQuery] string? difficulty)
    {
        try
        {
            var stream = await _service.ExportToExcelAsync(search, type, difficulty);
            return File(stream, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "questions.xlsx");
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("bulk-export")]
    public async Task<IActionResult> BulkExportQuestions([FromBody] List<int> ids)
    {
        try
        {
            var stream = await _service.ExportSelectedToExcelAsync(ids);
            return File(stream, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "questions.xlsx");
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
