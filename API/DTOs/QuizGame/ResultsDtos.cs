namespace API.DTOs.QuizGame;
using API.Entities.QuizGame;

public class SessionQuestionAnalysisDto
{
    public int QuestionId { get; set; }
    public string QuestionTitle { get; set; } = string.Empty;
    public int CorrectCount { get; set; }
    public int WrongCount { get; set; }
    public double AverageResponseTimeMs { get; set; }
}

public class QuizSummaryDto
{
    public int QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public int TotalSessions { get; set; }
    public int TotalParticipants { get; set; }
    public double AverageScore { get; set; }
    public IEnumerable<LeaderboardItemDto> TopPlayers { get; set; } = Enumerable.Empty<LeaderboardItemDto>();
}

public class PlayerSessionHistoryItemDto
{
    public int SessionId { get; set; }
    public int QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public GameSessionStatus SessionStatus { get; set; }
    public DateTime? SessionStartedAt { get; set; }
    public DateTime? SessionEndedAt { get; set; }
    public DateTime JoinedAt { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public int TotalScore { get; set; }
    public int? Rank { get; set; }
    public int TotalParticipants { get; set; }
    public int CorrectAnswers { get; set; }
    public int WrongAnswers { get; set; }
    public double AverageResponseTimeMs { get; set; }
}
