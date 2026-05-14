using API.Data;
using API.DTOs.QuizGame;
using API.Entities.QuizGame;
using API.Interfaces.QuizGame;
using Microsoft.EntityFrameworkCore;

namespace API.Services.QuizGame;

public class QuestionCategoryService : IQuestionCategoryService
{
    private readonly DataContext _context;

    public QuestionCategoryService(DataContext context)
    {
        _context = context;
    }

    public async Task<List<QuestionCategoryDto>> GetAllAsync()
    {
        var categories = await _context.QuestionCategories
            .Where(x => !x.IsDeleted)
            .Include(x => x.QuestionCategoryAssignments.Where(link => !link.IsDeleted))
            .ThenInclude(link => link.Question)
            .OrderBy(x => x.Name)
            .ToListAsync();

        return categories.Select(c => new QuestionCategoryDto
        {
            Id = c.Id,
            Name = c.Name,
            Description = c.Description,
            Color = c.Color,
            QuestionsCount = c.QuestionCategoryAssignments.Count(link => !link.Question.IsDeleted),
            CreatedAt = c.CreatedAt
        }).ToList();
    }

    public async Task<QuestionCategoryDto?> GetByIdAsync(int id)
    {
        var category = await _context.QuestionCategories
            .Where(x => !x.IsDeleted && x.Id == id)
            .Include(x => x.QuestionCategoryAssignments.Where(link => !link.IsDeleted))
            .ThenInclude(link => link.Question)
            .FirstOrDefaultAsync();

        if (category == null) return null;

        return new QuestionCategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            Color = category.Color,
            QuestionsCount = category.QuestionCategoryAssignments.Count(link => !link.Question.IsDeleted),
            CreatedAt = category.CreatedAt
        };
    }

    public async Task<QuestionCategoryDto> CreateAsync(QuestionCategoryCreateDto dto)
    {
        var category = new QuestionCategory
        {
            Name = dto.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            Color = dto.Color,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        _context.QuestionCategories.Add(category);
        await _context.SaveChangesAsync();

        return new QuestionCategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            Color = category.Color,
            QuestionsCount = 0,
            CreatedAt = category.CreatedAt
        };
    }

    public async Task<QuestionCategoryDto?> UpdateAsync(int id, QuestionCategoryCreateDto dto)
    {
        var category = await _context.QuestionCategories
            .Where(x => !x.IsDeleted && x.Id == id)
            .FirstOrDefaultAsync();

        if (category == null) return null;

        category.Name = dto.Name.Trim();
        category.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        category.Color = dto.Color;

        await _context.SaveChangesAsync();

        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var category = await _context.QuestionCategories
            .Where(x => !x.IsDeleted && x.Id == id)
            .FirstOrDefaultAsync();

        if (category == null) return false;

        category.IsDeleted = true;
        await _context.SaveChangesAsync();

        return true;
    }
}
