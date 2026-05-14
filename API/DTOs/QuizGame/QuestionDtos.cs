using API.Entities.QuizGame;

namespace API.DTOs.QuizGame;

public class PagedRequestDto
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? Search { get; set; }
}

public class PagedResultDto<T>
{
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public IEnumerable<T> Items { get; set; } = Enumerable.Empty<T>();
}

public class QuestionChoiceDto
{
    public int Id { get; set; }
    public string ChoiceText { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public bool HasImage { get; set; }
    public bool IsCorrect { get; set; }
    public int Order { get; set; }
}

public class QuestionCreateUpdateDto
{
    public string Title { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public QuestionType Type { get; set; }
    public QuestionSelectionMode SelectionMode { get; set; } = QuestionSelectionMode.Single;
    public string? Difficulty { get; set; }
    public string? Explanation { get; set; }
    public int Points { get; set; }
    public int AnswerSeconds { get; set; } = 30;
    public int? CategoryId { get; set; }
    public List<int>? CategoryIds { get; set; }
    public int? QuizId { get; set; }
    public List<QuestionChoiceDto> Choices { get; set; } = new();
}

public class QuestionCategoryRefDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class QuestionResponseDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public QuestionType Type { get; set; }
    public QuestionSelectionMode SelectionMode { get; set; }
    public string? Difficulty { get; set; }
    public string? ImageUrl { get; set; }
    public string? Explanation { get; set; }
    public int Points { get; set; }
    public int AnswerSeconds { get; set; } = 30;
    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public List<QuestionCategoryRefDto> Categories { get; set; } = new();
    public int? QuizId { get; set; }
    public string? QuizTitle { get; set; }
    public List<QuestionChoiceDto> Choices { get; set; } = new();
}

public class QuestionQueryDto : PagedRequestDto
{
    public QuestionType? Type { get; set; }
    public QuestionSelectionMode? SelectionMode { get; set; }
    public string? Difficulty { get; set; }
    public int? CategoryId { get; set; }
}

public class CategoryRandomQuestionRequest
{
    public int CategoryId { get; set; }
    public int Count { get; set; }
}

public class RandomQuestionSelectionRequest
{
    public List<CategoryRandomQuestionRequest> CategorySelections { get; set; } = new();
}

public class RandomQuestionResultDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int RequestedCount { get; set; }
    public int AvailableCount { get; set; }
    public List<QuestionResponseDto> Questions { get; set; } = new();
}

public class BulkQuestionCategoryDto
{
    public List<int> Ids { get; set; } = new();
    public string CategoryName { get; set; } = string.Empty;
}
