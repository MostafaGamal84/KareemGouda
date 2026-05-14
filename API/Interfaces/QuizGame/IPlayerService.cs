using API.DTOs.QuizGame;

namespace API.Interfaces.QuizGame;

public interface IPlayerService
{
    Task<PlayerJoinResponseDto?> JoinAsync(PlayerJoinDto dto, int? userId);
    Task<WaitingRoomDto?> GetWaitingRoomAsync(int sessionId);
    Task<QuestionResponseDto?> GetCurrentQuestionAsync(int sessionId);
    Task<PlayerAnswerSubmitResponseDto> SubmitAnswerAsync(int sessionId, SubmitPlayerAnswerDto dto);
    Task<List<LeaderboardItemDto>> GetLeaderboardAsync(int sessionId);
    Task<ParticipantResultDto?> GetResultAsync(int sessionId, int participantId);
    Task<ParticipantJoinStatusDto?> GetParticipantStatusAsync(int sessionId, int participantId, string? participantToken);
    Task<bool> LeaveSessionAsync(int sessionId, LeaveSessionDto dto);
}
