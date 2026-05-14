using API.DTOs.QuizGame;
using API.Extensions;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.QuizGame;

[ApiController]
[Route("api/quizzes")]
public class QuizzesController : ControllerBase
{
    private readonly IQuizService _service;
    private readonly IQuizImportExportService _importExportService;

    public QuizzesController(IQuizService service, IQuizImportExportService importExportService)
    {
        _service = service;
        _importExportService = importExportService;
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] QuizCreateUpdateDto dto)
    {
        var result = await _service.CreateAsync(dto, User.GetUserId());
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] QuizCreateUpdateDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        return result is null ? NotFound(new { message = "Quiz not found" }) : Ok(result);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/cover-image")]
    public async Task<IActionResult> UploadCoverImage(int id, [FromForm] IFormFile? file)
    {
        if (file is null)
        {
            return BadRequest(new { message = "Image file is required." });
        }

        try
        {
            var coverImageUrl = await _service.UploadCoverImageAsync(id, file);
            return coverImageUrl is null
                ? NotFound(new { message = "Quiz not found" })
                : Ok(new { coverImageUrl });
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
        var deleted = await _service.DeleteAsync(id);
        return deleted ? Ok(new { message = "Quiz deleted" }) : NotFound(new { message = "Quiz not found" });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] QuizQueryDto query)
    {
        return Ok(await _service.GetAllAsync(query));
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        return Ok(await _service.GetCategoriesAsync());
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var quiz = await _service.GetByIdAsync(id);
        return quiz is null ? NotFound(new { message = "Quiz not found" }) : Ok(quiz);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/questions")]
    public async Task<IActionResult> AddQuestions(int id, [FromBody] List<QuizQuestionAddDto> dto)
    {
        try
        {
            var ok = await _service.AddQuestionsAsync(id, dto);
            return ok ? Ok(new { message = "Questions added" }) : NotFound(new { message = "Quiz not found" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpDelete("{id:int}/questions/{quizQuestionId:int}")]
    public async Task<IActionResult> RemoveQuestion(int id, int quizQuestionId)
    {
        var ok = await _service.RemoveQuestionAsync(id, quizQuestionId);
        return ok ? Ok(new { message = "Quiz question removed" }) : NotFound(new { message = "Quiz question not found" });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPut("{id:int}/questions/reorder")]
    public async Task<IActionResult> ReorderQuestions(int id, [FromBody] List<QuizQuestionReorderItemDto> dto)
    {
        var ok = await _service.ReorderAsync(id, dto);
        return ok ? Ok(new { message = "Quiz questions reordered" }) : NotFound(new { message = "Quiz questions not found" });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPut("{id:int}/publish")]
    public async Task<IActionResult> Publish(int id, [FromBody] QuizPublishDto dto)
    {
        try
        {
            var ok = await _service.PublishAsync(id, dto.IsPublished);
            return ok ? Ok(new { message = dto.IsPublished ? "Quiz published" : "Quiz unpublished" }) : NotFound(new { message = "Quiz not found" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("{id:int}/export")]
    public async Task<IActionResult> ExportQuiz(int id)
    {
        try
        {
            var excelData = await _importExportService.ExportQuizToExcelAsync(id);
            return File(excelData, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"quiz_{id}.xlsx");
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("import")]
    public async Task<IActionResult> ImportQuiz(IFormFile file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Please select an Excel file" });
        }

        var allowedExtensions = new[] { ".xlsx", ".xls" };
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension))
        {
            return BadRequest(new { message = "Only Excel files (.xlsx, .xls) are allowed" });
        }

        try
        {
            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var result = await _importExportService.ImportQuizFromExcelAsync(memoryStream.ToArray(), User.GetUserId());

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return CreatedAtAction(nameof(GetById), new { id = result.QuizId }, result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Import failed: {ex.Message}" });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/duplicate")]
    public async Task<IActionResult> DuplicateQuiz(int id)
    {
        var result = await _service.DuplicateAsync(id, User.GetUserId());
        return result is null ? NotFound(new { message = "Quiz not found" }) : CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("bulk-duplicate")]
    public async Task<IActionResult> BulkDuplicate([FromBody] List<int> ids)
    {
        if (ids is null || ids.Count == 0)
        {
            return BadRequest(new { message = "No IDs provided" });
        }

        var duplicated = 0;
        foreach (var id in ids)
        {
            var result = await _service.DuplicateAsync(id, User.GetUserId());
            if (result is not null)
            {
                duplicated++;
            }
        }

        return Ok(new { message = $"Duplicated {duplicated} quizzes", duplicatedCount = duplicated });
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
            if (await _service.DeleteAsync(id))
            {
                deleted++;
            }
        }

        return Ok(new { message = $"Deleted {deleted} quizzes", deletedCount = deleted });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("bulk-publish")]
    public async Task<IActionResult> BulkPublish([FromBody] BulkActionDto dto)
    {
        if (dto.Ids is null || dto.Ids.Count == 0)
        {
            return BadRequest(new { message = "No IDs provided" });
        }

        var updated = 0;
        foreach (var id in dto.Ids)
        {
            try
            {
                if (await _service.PublishAsync(id, dto.Publish))
                {
                    updated++;
                }
            }
            catch (InvalidOperationException)
            {
                // Skip live-delivery quizzes
            }
        }

        return Ok(new { message = $"Updated {updated} quizzes", updatedCount = updated });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("bulk-add-category")]
    public async Task<IActionResult> BulkAddCategory([FromBody] BulkQuizCategoryDto dto)
    {
        if (dto.Ids is null || dto.Ids.Count == 0)
        {
            return BadRequest(new { message = "No IDs provided" });
        }

        if (string.IsNullOrWhiteSpace(dto.CategoryName))
        {
            return BadRequest(new { message = "Category name is required" });
        }

        var added = await _service.AddCategoryToQuizzesAsync(dto.Ids, dto.CategoryName);
        var categoryName = dto.CategoryName.Trim();

        return Ok(new
        {
            message = added > 0
                ? $"Category '{categoryName}' added to {added} quizzes"
                : $"Selected quizzes already include '{categoryName}'",
            updatedCount = added,
            categoryName
        });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("bulk-remove-category")]
    public async Task<IActionResult> BulkRemoveCategory([FromBody] BulkQuizCategoryDto dto)
    {
        if (dto.Ids is null || dto.Ids.Count == 0)
        {
            return BadRequest(new { message = "No IDs provided" });
        }

        if (string.IsNullOrWhiteSpace(dto.CategoryName))
        {
            return BadRequest(new { message = "Category name is required" });
        }

        var removed = await _service.RemoveCategoryFromQuizzesAsync(dto.Ids, dto.CategoryName);
        var categoryName = dto.CategoryName.Trim();

        return Ok(new
        {
            message = removed > 0
                ? $"Category '{categoryName}' removed from {removed} quizzes"
                : $"Selected quizzes do not include '{categoryName}'",
            updatedCount = removed,
            categoryName
        });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("bulk-export")]
    public async Task<IActionResult> BulkExport([FromBody] List<int> ids)
    {
        if (ids is null || ids.Count == 0)
        {
            return BadRequest(new { message = "No IDs provided" });
        }

        try
        {
            using var memoryStream = new MemoryStream();
            using var archive = new System.IO.Compression.ZipArchive(memoryStream, System.IO.Compression.ZipArchiveMode.Create, true);

            foreach (var id in ids)
            {
                try
                {
                    var excelData = await _importExportService.ExportQuizToExcelAsync(id);
                    var quiz = await _service.GetByIdAsync(id);
                    var fileName = $"quiz_{id}_{SanitizeFileName(quiz?.Title ?? "quiz")}.xlsx";
                    var entry = archive.CreateEntry(fileName);
                    using var entryStream = entry.Open();
                    entryStream.Write(excelData, 0, excelData.Length);
                }
                catch { }
            }

            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", "quizzes_export.zip");
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Export failed: {ex.Message}" });
        }
    }

    private static string SanitizeFileName(string name)
    {
        var invalid = System.IO.Path.GetInvalidFileNameChars();
        return string.Join("_", name.Split(invalid, StringSplitOptions.RemoveEmptyEntries)).Trim();
    }
}

public class BulkActionDto
{
    public List<int> Ids { get; set; } = new();
    public bool Publish { get; set; }
}
