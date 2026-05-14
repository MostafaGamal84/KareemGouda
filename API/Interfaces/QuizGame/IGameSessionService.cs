using API.DTOs.QuizGame;

namespace API.Interfaces.QuizGame;

public interface IGameSessionService
{
    Task<GameSessionResponseDto> CreateAsync(CreateGameSessionDto dto, int? hostId, string baseUrl);
    Task<IEnumerable<GameSessionResponseDto>> GetAllAsync();
    Task<GameSessionResponseDto?> GetByIdAsync(int id);
    Task<GameSessionResponseDto?> GetByCodeAsync(string joinCode);
    Task<SessionStateDto?> StartAsync(int id);
    Task<SessionStateDto?> PauseAsync(int id);
    Task<SessionStateDto?> ResumeAsync(int id);
    Task<SessionStateDto?> EndAsync(int id);
    Task<SessionStateDto?> NextQuestionAsync(int id);
    Task<List<LeaderboardItemDto>> GetLeaderboardAsync(int id);
    Task<SessionStateDto?> GetStateAsync(int id);
    Task<List<JoinRequestItemDto>> GetJoinRequestsAsync(int sessionId);
    Task<JoinRequestItemDto?> ApproveJoinRequestAsync(int sessionId, int participantId, int? hostId);
    Task<JoinRequestItemDto?> RejectJoinRequestAsync(int sessionId, int participantId, int? hostId, string? note);
    Task<bool> DeleteAsync(int id);
    Task AutoAdvanceTimedSessionsAsync(DateTime? nowUtc = null);
    Task<List<StudentLiveSessionBrowseDto>> GetLiveBrowseForStudentAsync(int? userId);
}
