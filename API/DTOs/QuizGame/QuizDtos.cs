using API.Entities.QuizGame;

namespace API.DTOs.QuizGame;

public class QuizCreateUpdateDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public QuizMode Mode { get; set; }
    public bool? ShowExplanationAfterEachAnswer { get; set; }
    public int DurationMinutes { get; set; }
    public int? TotalMarks { get; set; }
    public bool IsPublished { get; set; }
    public List<string> Categories { get; set; } = new();
}

public class QuizQuestionAddDto
{
    public int QuestionId { get; set; }
    public int Order { get; set; }
    public int? PointsOverride { get; set; }
    public int? AnswerSeconds { get; set; }
}

public class QuizQuestionReorderItemDto
{
    public int QuizQuestionId { get; set; }
    public int Order { get; set; }
    public int? AnswerSeconds { get; set; }
}

public class QuizQuestionResponseDto
{
    public int Id { get; set; }
    public int QuestionId { get; set; }
    public string QuestionTitle { get; set; } = string.Empty;
    public int Order { get; set; }
    public int? PointsOverride { get; set; }
    public int AnswerSeconds { get; set; }
    public QuestionResponseDto? Question { get; set; }
}

public class QuizCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class QuizResponseDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CoverImageUrl { get; set; }
    public QuizMode Mode { get; set; }
    public bool ShowExplanationAfterEachAnswer { get; set; }
    public int DurationMinutes { get; set; }
    public int? TotalMarks { get; set; }
    public int EffectiveTotalMarks { get; set; }
    public bool IsPublished { get; set; }
    /// <summary>From QuizAccess when present: 1=Live, 2=Test.</summary>
    public int? ExamMode { get; set; }
    /// <summary>From QuizAccess when present: 1=Public, 2=Custom.</summary>
    public int? AccessType { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public int QuestionsCount { get; set; }
    public List<QuizCategoryDto> Categories { get; set; } = new();
    public List<QuizQuestionResponseDto> Questions { get; set; } = new();
}

public class QuizPublishDto
{
    public bool IsPublished { get; set; }
}

public class BulkQuizCategoryDto
{
    public List<int> Ids { get; set; } = new();
    public string CategoryName { get; set; } = string.Empty;
}

public class QuizQueryDto : PagedRequestDto
{
    public QuizMode? Mode { get; set; }
    public bool? IsPublished { get; set; }
    public string? Category { get; set; }
    /// <summary>When set, only quizzes whose QuizAccess has this exam mode (e.g. Test for student test list).</summary>
    public ExamMode? ExamMode { get; set; }
}

public class QuizExportDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Mode { get; set; } = string.Empty;
    public int DurationMinutes { get; set; }
    public int? TotalMarks { get; set; }
    public int MaxAttempts { get; set; } = 1;
    public List<QuestionExportDto> Questions { get; set; } = new();
}

public class QuestionExportDto
{
    public string Title { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? SelectionMode { get; set; }
    public string? Difficulty { get; set; }
    public string? Explanation { get; set; }
    public int Points { get; set; }
    public int AnswerSeconds { get; set; }
    public string? CategoryName { get; set; }
    public List<ChoiceExportDto> Choices { get; set; } = new();
}

public class ChoiceExportDto
{
    public string ChoiceText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int Order { get; set; }
}

public class QuizImportDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Mode { get; set; } = "Test";
    public int DurationMinutes { get; set; } = 30;
    public int? TotalMarks { get; set; }
    public int MaxAttempts { get; set; } = 1;
    public List<QuestionImportDto> Questions { get; set; } = new();
}

public class QuestionImportDto
{
    public string Title { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Type { get; set; } = "MultipleChoice";
    public string? SelectionMode { get; set; }
    public string? Difficulty { get; set; }
    public string? Explanation { get; set; }
    public int Points { get; set; } = 1;
    public int AnswerSeconds { get; set; } = 30;
    public string? CategoryName { get; set; }
    public List<ChoiceImportDto> Choices { get; set; } = new();
}

public class ChoiceImportDto
{
    public string ChoiceText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int Order { get; set; }
}

public class ImportResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int QuizId { get; set; }
}
