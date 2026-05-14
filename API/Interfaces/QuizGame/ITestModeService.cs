using API.DTOs.QuizGame;

namespace API.Interfaces.QuizGame;

public interface ITestModeService
{
    Task<TestAttemptResponseDto?> StartAsync(int quizId, int? userId, StartTestAttemptDto dto);
    Task<TestAttemptOverviewDto?> GetAttemptOverviewAsync(int attemptId, int userId, bool canAccessAll);
    Task<List<TestModeQuestionDto>> GetQuestionsAsync(int attemptId, int userId, bool canAccessAll);
    Task<TestModeQuestionDto?> GetCurrentQuestionAsync(int attemptId, int userId, int? questionIndex, bool canAccessAll);
    Task<TestAnswerSubmitResponseDto> SubmitAnswerAsync(int attemptId, int userId, SubmitTestAnswerDto dto, bool canAccessAll);
    Task<TestResultDto?> FinishAsync(int attemptId, int userId, FinishTestAttemptDto dto, bool canAccessAll);
    Task<TestResultDto?> GetResultAsync(int attemptId, int userId, bool canAccessAll);
    Task<IEnumerable<PlayerTestHistoryItemDto>> GetMyHistoryAsync(int userId);
}
