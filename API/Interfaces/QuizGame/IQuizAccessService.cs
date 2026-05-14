using API.DTOs.QuizGame;

namespace API.Interfaces.QuizGame;

public interface IQuizAccessService
{
    Task<QuizAccessDto?> GetByQuizIdAsync(int quizId);
    Task<QuizAccessDto> CreateOrUpdateAsync(int quizId, QuizAccessCreateUpdateDto dto);
    Task<QuizAccessDto?> AddUsersAsync(int quizId, QuizAccessAddUsersDto dto);
    Task<QuizAccessDto?> RemoveUserAsync(int quizId, int userAccessId);
    Task<QuizAccessDto?> UpdateUserStatusAsync(int quizId, int userAccessId, QuizAccessUpdateUserStatusDto dto);
    Task<QuizAccessDto?> AddGroupsAsync(int quizId, QuizAccessAddGroupsDto dto);
    Task<QuizAccessDto?> RemoveGroupAsync(int quizId, int groupAccessId);
    Task<bool> ApproveExtraAttemptsAsync(int quizId, QuizAccessApproveExtraAttemptsDto dto);
    Task<AttemptCheckResultDto> CheckAttemptAsync(int quizId, int userId);
    Task<List<UserSummaryDto>> GetAvailableStudentsAsync(int quizId);
    Task<List<StudentGroupDto>> GetAvailableGroupsAsync(int quizId);
}
