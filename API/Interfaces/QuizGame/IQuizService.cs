using API.DTOs.QuizGame;
using Microsoft.AspNetCore.Http;

namespace API.Interfaces.QuizGame;

public interface IQuizService
{
    Task<QuizResponseDto> CreateAsync(QuizCreateUpdateDto dto, int? userId);
    Task<QuizResponseDto?> UpdateAsync(int id, QuizCreateUpdateDto dto);
    Task<bool> DeleteAsync(int id);
    Task<QuizResponseDto?> GetByIdAsync(int id);
    Task<PagedResultDto<QuizResponseDto>> GetAllAsync(QuizQueryDto query);
    Task<List<QuizCategoryDto>> GetCategoriesAsync();
    Task<string?> UploadCoverImageAsync(int quizId, IFormFile file);
    Task<bool> AddQuestionsAsync(int quizId, List<QuizQuestionAddDto> questions);
    Task<bool> RemoveQuestionAsync(int quizId, int quizQuestionId);
    Task<bool> ReorderAsync(int quizId, List<QuizQuestionReorderItemDto> items);
    Task<bool> PublishAsync(int quizId, bool isPublished);
    Task<QuizResponseDto?> DuplicateAsync(int quizId, int userId);
    Task<int> AddCategoryToQuizzesAsync(IEnumerable<int> quizIds, string categoryName);
    Task<int> RemoveCategoryFromQuizzesAsync(IEnumerable<int> quizIds, string categoryName);
}
