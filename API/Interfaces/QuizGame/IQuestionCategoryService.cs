using API.DTOs.QuizGame;

namespace API.Interfaces.QuizGame;

public interface IQuestionCategoryService
{
    Task<List<QuestionCategoryDto>> GetAllAsync();
    Task<QuestionCategoryDto?> GetByIdAsync(int id);
    Task<QuestionCategoryDto> CreateAsync(QuestionCategoryCreateDto dto);
    Task<QuestionCategoryDto?> UpdateAsync(int id, QuestionCategoryCreateDto dto);
    Task<bool> DeleteAsync(int id);
}
