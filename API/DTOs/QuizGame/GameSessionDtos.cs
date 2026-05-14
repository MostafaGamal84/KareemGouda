using API.Entities.QuizGame;

namespace API.DTOs.QuizGame;

public class CreateGameSessionDto
{
    public int QuizId { get; set; }
    public SessionQuestionFlowMode QuestionFlowMode { get; set; } = SessionQuestionFlowMode.HostControlled;
    public SessionAccessType AccessType { get; set; } = SessionAccessType.Private;
    public DateTime? ScheduledStartAt { get; set; }
    public DateTime? ScheduledEndAt { get; set; }
    public int? DurationMinutes { get; set; }
    /// <summary>Required for private sessions: users who may join without host approval.</summary>
    public List<int> AllowedUserIds { get; set; } = new();
}

public class GameSessionResponseDto
{
    public int Id { get; set; }
    public int QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public string? QuizCoverImageUrl { get; set; }
    public int? HostId { get; set; }
    public string JoinCode { get; set; } = string.Empty;
    public string JoinLink { get; set; } = string.Empty;
    public GameSessionStatus Status { get; set; }
    public SessionAccessType AccessType { get; set; }
    public SessionQuestionFlowMode QuestionFlowMode { get; set; }
    public DateTime? ScheduledStartAt { get; set; }
    public DateTime? ScheduledEndAt { get; set; }
    public int? DurationMinutes { get; set; }
    public int CurrentQuestionIndex { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public int ParticipantsCount { get; set; }
    public List<QuizCategoryDto> Categories { get; set; } = new();
    public List<int> AllowedUserIds { get; set; } = new();
}

public class StudentLiveSessionBrowseDto
{
    public int SessionId { get; set; }
    public int QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public GameSessionStatus Status { get; set; }
    public SessionAccessType AccessType { get; set; }
    public string JoinCode { get; set; } = string.Empty;
    public string JoinLink { get; set; } = string.Empty;
    public bool CanJoin { get; set; }
    public string? JoinHint { get; set; }
}

public class SessionStateDto
{
    public int SessionId { get; set; }
    public int QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public string? QuizCoverImageUrl { get; set; }
    public GameSessionStatus Status { get; set; }
    public SessionAccessType AccessType { get; set; }
    public SessionQuestionFlowMode QuestionFlowMode { get; set; }
    public DateTime? ScheduledStartAt { get; set; }
    public DateTime? ScheduledEndAt { get; set; }
    public int? DurationMinutes { get; set; }
    public int CurrentQuestionIndex { get; set; }
    public QuestionResponseDto? CurrentQuestion { get; set; }
    public QuestionResponseDto? NextQuestion { get; set; }
    public DateTime? CurrentQuestionEndsAtUtc { get; set; }
    public int? CurrentQuestionDurationSeconds { get; set; }
    public int ParticipantsCount { get; set; }
}

public class JoinRequestItemDto
{
    public int ParticipantId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public ParticipantJoinStatus JoinStatus { get; set; }
    public DateTime RequestedAt { get; set; }
    public string? DecisionNote { get; set; }
}

public class JoinRequestDecisionDto
{
    public string? DecisionNote { get; set; }
}

public class LeaderboardItemDto
{
    public int ParticipantId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public int TotalScore { get; set; }
    public int Rank { get; set; }
}
