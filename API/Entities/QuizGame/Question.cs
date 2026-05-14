using Entities;

namespace API.Entities.QuizGame;

public class Question : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public QuestionType Type { get; set; }
    public QuestionSelectionMode SelectionMode { get; set; } = QuestionSelectionMode.Single;
    public string? Difficulty { get; set; }
    public string? Explanation { get; set; }
    public int Points { get; set; }
    public int AnswerSeconds { get; set; } = 30;
    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CategoryId { get; set; }
    public int? QuizId { get; set; }
    public virtual QuestionCategory? Category { get; set; }
    public virtual Quiz? Quiz { get; set; }
    public virtual ICollection<QuestionChoice> Choices { get; set; } = new List<QuestionChoice>();
    public virtual ICollection<QuestionCategoryAssignment> QuestionCategoryAssignments { get; set; } = new List<QuestionCategoryAssignment>();
    public virtual ICollection<QuizQuestion> QuizQuestions { get; set; } = new List<QuizQuestion>();
}

public class QuestionChoice : BaseEntity
{
    public int QuestionId { get; set; }
    public string ChoiceText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int Order { get; set; }
    public virtual Question Question { get; set; } = null!;
}
