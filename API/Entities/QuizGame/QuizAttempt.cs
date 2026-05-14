using Entities;

namespace API.Entities.QuizGame;

public class QuizAttempt : BaseEntity
{
    public int QuizId { get; set; }
    public int? UserId { get; set; }
    public string? ParticipantName { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
    public bool IsFinished { get; set; }
    public int TotalScore { get; set; }
    public int CurrentQuestionIndex { get; set; }
    public DateTime? TimerStartedAt { get; set; }
    public int? ElapsedSeconds { get; set; }
    public virtual Quiz Quiz { get; set; } = null!;
    public virtual ICollection<QuizAttemptAnswer> Answers { get; set; } = new List<QuizAttemptAnswer>();
}

public class QuizAttemptAnswer : BaseEntity
{
    public int QuizAttemptId { get; set; }
    public int QuestionId { get; set; }
    public int? SelectedChoiceId { get; set; }
    public string? SelectedChoiceIdsJson { get; set; }
    public string? TextAnswer { get; set; }
    public bool IsCorrect { get; set; }
    public int ScoreAwarded { get; set; }
    public DateTime AnsweredAt { get; set; } = DateTime.UtcNow;
    public virtual QuizAttempt QuizAttempt { get; set; } = null!;
    public virtual Question Question { get; set; } = null!;
    public virtual QuestionChoice? SelectedChoice { get; set; }
}
