namespace API.DTOs.QuizGame;

public class QuestionCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Color { get; set; }
    public int QuestionsCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class QuestionCategoryCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Color { get; set; } = 0x6366F1;
}

public class CategorySelectionDto
{
    public int CategoryId { get; set; }
    public int NumberOfQuestions { get; set; } = 10;
}
