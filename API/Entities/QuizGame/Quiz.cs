using Entities;

namespace API.Entities.QuizGame;

public class Quiz : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public QuizMode Mode { get; set; }
    public int DurationMinutes { get; set; }
    public bool IsPublished { get; set; }
    public int MaxAttempts { get; set; } = 1;
    public int? TotalMarks { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public virtual ICollection<QuizQuestion> QuizQuestions { get; set; } = new List<QuizQuestion>();
    public virtual ICollection<QuizCategory> QuizCategories { get; set; } = new List<QuizCategory>();
    public virtual QuizAccess? QuizAccess { get; set; }
}

public class QuizQuestion : BaseEntity
{
    public int QuizId { get; set; }
    public int QuestionId { get; set; }
    public int Order { get; set; }
    public int? PointsOverride { get; set; }
    public int AnswerSeconds { get; set; } = 30;
    public virtual Quiz Quiz { get; set; } = null!;
    public virtual Question Question { get; set; } = null!;
}

public class QuizCategory : BaseEntity
{
    public int QuizId { get; set; }
    public int CategoryId { get; set; }
    public virtual Quiz Quiz { get; set; } = null!;
    public virtual Category Category { get; set; } = null!;
}
