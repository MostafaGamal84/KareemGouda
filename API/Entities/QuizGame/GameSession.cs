using Entities;

namespace API.Entities.QuizGame;

public class GameSession : BaseEntity
{
    public int QuizId { get; set; }
    public int? HostId { get; set; }
    public string JoinCode { get; set; } = string.Empty;
    public string JoinLink { get; set; } = string.Empty;
    public GameSessionStatus Status { get; set; } = GameSessionStatus.Draft;
    public SessionAccessType AccessType { get; set; } = SessionAccessType.Private;
    public SessionQuestionFlowMode QuestionFlowMode { get; set; } = SessionQuestionFlowMode.HostControlled;
    public DateTime? ScheduledStartAt { get; set; }
    public DateTime? ScheduledEndAt { get; set; }
    public int? DurationMinutes { get; set; }
    public int CurrentQuestionIndex { get; set; }
    public DateTime? CurrentQuestionStartedAt { get; set; }
    public DateTime? CurrentQuestionEndsAt { get; set; }
    public int? CurrentQuestionRemainingSeconds { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public virtual Quiz Quiz { get; set; } = null!;
    public virtual ICollection<GameParticipant> Participants { get; set; } = new List<GameParticipant>();
    public virtual ICollection<PlayerAnswer> Answers { get; set; } = new List<PlayerAnswer>();
    public virtual ICollection<GameSessionAllowedUser> AllowedUsers { get; set; } = new List<GameSessionAllowedUser>();
}

public class GameParticipant : BaseEntity
{
    public int GameSessionId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public int? UserId { get; set; }
    public ParticipantJoinStatus JoinStatus { get; set; } = ParticipantJoinStatus.Pending;
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedAt { get; set; }
    public DateTime? RejectedAt { get; set; }
    public DateTime? LeftAt { get; set; }
    public int? DecisionByHostId { get; set; }
    public string? DecisionNote { get; set; }
    public int TotalScore { get; set; }
    public int? Rank { get; set; }
    public bool IsConnected { get; set; } = true;
    public string ParticipantToken { get; set; } = Guid.NewGuid().ToString("N");
    public virtual GameSession GameSession { get; set; } = null!;
    public virtual ICollection<PlayerAnswer> Answers { get; set; } = new List<PlayerAnswer>();
}

public class PlayerAnswer : BaseEntity
{
    public int GameSessionId { get; set; }
    public int ParticipantId { get; set; }
    public int QuestionId { get; set; }
    public int? SelectedChoiceId { get; set; }
    public string? SelectedChoiceIdsJson { get; set; }
    public string? TextAnswer { get; set; }
    public bool IsCorrect { get; set; }
    public int ScoreAwarded { get; set; }
    public long? ResponseTimeMs { get; set; }
    public DateTime AnsweredAt { get; set; } = DateTime.UtcNow;
    public virtual GameSession GameSession { get; set; } = null!;
    public virtual GameParticipant Participant { get; set; } = null!;
    public virtual Question Question { get; set; } = null!;
    public virtual QuestionChoice? SelectedChoice { get; set; }
}
