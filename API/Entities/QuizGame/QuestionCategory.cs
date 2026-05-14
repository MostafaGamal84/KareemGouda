using Entities;

namespace API.Entities.QuizGame;

public class QuestionCategory : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Color { get; set; } = 0x6366F1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public virtual ICollection<Question> Questions { get; set; } = new List<Question>();
    public virtual ICollection<QuestionCategoryAssignment> QuestionCategoryAssignments { get; set; } = new List<QuestionCategoryAssignment>();
}
