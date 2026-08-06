using API.DTOs.QuizGame;
using API.Entities.QuizGame;
using Microsoft.AspNetCore.Http;

namespace API.Interfaces.QuizGame;

public interface IQuestionService
{
    Task<QuestionResponseDto> CreateAsync(QuestionCreateUpdateDto dto, int? userId);
    Task<QuestionResponseDto?> UpdateAsync(int id, QuestionCreateUpdateDto dto);
    Task<bool> SoftDeleteAsync(int id);
    Task<QuestionResponseDto?> GetByIdAsync(int id);
    Task<PagedResultDto<QuestionResponseDto>> GetAllAsync(QuestionQueryDto query);
    Task<string?> UploadImageAsync(int questionId, IFormFile file);
    Task<string?> UploadChoiceImageAsync(int questionId, int choiceId, IFormFile file);
    Task<List<RandomQuestionResultDto>> GetRandomQuestionsByCategoryAsync(RandomQuestionSelectionRequest request);
    Task<List<QuestionCategory>> GetCategoriesWithQuestionCountsAsync();
    Task<QuestionResponseDto?> DuplicateAsync(int questionId, int userId);
    Task<int> AddCategoryToQuestionsAsync(IEnumerable<int> questionIds, string categoryName);
    Task<int> RemoveCategoryFromQuestionsAsync(IEnumerable<int> questionIds, string? categoryName = null);
    Task<int> UpdateSettingsAsync(IEnumerable<int> questionIds, int? points, int? answerSeconds);
    Task<int> ImportFromExcelAsync(IFormFile file);
    Task<Stream> ExportToExcelAsync(string? search = null, int? type = null, string? difficulty = null);
    Task<Stream> ExportSelectedToExcelAsync(List<int> ids);
}
