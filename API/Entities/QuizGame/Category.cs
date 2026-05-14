using Entities;

namespace API.Entities.QuizGame;

public class Category : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public virtual ICollection<QuizCategory> QuizCategories { get; set; } = new List<QuizCategory>();
}
