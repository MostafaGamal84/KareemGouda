using Entities;

namespace API.Entities.QuizGame;

public class QuestionCategoryAssignment : BaseEntity
{
    public int QuestionId { get; set; }
    public int CategoryId { get; set; }
    public virtual Question Question { get; set; } = null!;
    public virtual QuestionCategory Category { get; set; } = null!;
}
