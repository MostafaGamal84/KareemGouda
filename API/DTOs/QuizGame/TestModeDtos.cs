namespace API.DTOs.QuizGame;

public class StartTestAttemptDto
{
    public string? ParticipantName { get; set; }
}

public class TestAttemptResponseDto
{
    public int AttemptId { get; set; }
    public int QuizId { get; set; }
    public int CurrentQuestionIndex { get; set; }
    public bool IsFinished { get; set; }
    public bool Allowed { get; set; } = true;
    public string? Message { get; set; }
}

public class SubmitTestAnswerDto
{
    public int QuestionId { get; set; }
    public int? SelectedChoiceId { get; set; }
    public List<int> SelectedChoiceIds { get; set; } = new();
    public string? TextAnswer { get; set; }
}

public class FinishTestAttemptDto
{
    public List<SubmitTestAnswerDto> Answers { get; set; } = new();
}

public class TestAttemptQuestionItemDto
{
    public int QuestionIndex { get; set; }
    public int QuestionId { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsAnswered { get; set; }
    public bool IsCurrent { get; set; }
}

public class TestAttemptOverviewDto
{
    public int AttemptId { get; set; }
    public int QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public bool IsFinished { get; set; }
    public int DurationMinutes { get; set; }
    public int CurrentQuestionIndex { get; set; }
    public int TotalQuestions { get; set; }
    public int AnsweredQuestions { get; set; }
    public int RemainingQuestions { get; set; }
    public DateTime? TimerStartedAt { get; set; }
    public int ElapsedSeconds { get; set; }
    public List<TestAttemptQuestionItemDto> Questions { get; set; } = new();
}

public class TestModeQuestionDto
{
    public int QuestionIndex { get; set; }
    public int TotalQuestions { get; set; }
    public bool IsAnswered { get; set; }
    public int? SelectedChoiceId { get; set; }
    public List<int> SelectedChoiceIds { get; set; } = new();
    public string? TextAnswer { get; set; }
    public bool? IsCorrect { get; set; }
    public int? CorrectChoiceId { get; set; }
    public List<int> CorrectChoiceIds { get; set; } = new();
    public QuestionResponseDto Question { get; set; } = new();
}

public class TestAnswerSubmitResponseDto
{
    public bool Accepted { get; set; }
    public bool? IsCorrect { get; set; }
    public int? SelectedChoiceId { get; set; }
    public List<int> SelectedChoiceIds { get; set; } = new();
    public int? CorrectChoiceId { get; set; }
    public List<int> CorrectChoiceIds { get; set; } = new();
    public int? NextQuestionIndex { get; set; }
    public int AnsweredQuestions { get; set; }
    public int RemainingQuestions { get; set; }
    public string? Message { get; set; }
}

public class TestResultReviewItemDto
{
    public int QuestionIndex { get; set; }
    public int QuestionId { get; set; }
    public string QuestionTitle { get; set; } = string.Empty;
    public string QuestionText { get; set; } = string.Empty;
    public bool IsAnswered { get; set; }
    public bool IsCorrect { get; set; }
    public string? SelectedAnswerText { get; set; }
    public string CorrectAnswerText { get; set; } = string.Empty;
    public string? Explanation { get; set; }
}

public class TestResultDto
{
    public int AttemptId { get; set; }
    public int QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public string? ParticipantName { get; set; }
    public int TotalScore { get; set; }
    public int TotalQuestions { get; set; }
    public int AnsweredQuestions { get; set; }
    public int UnansweredQuestions { get; set; }
    public int CorrectAnswers { get; set; }
    public int WrongAnswers { get; set; }
    public double AccuracyPercent { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int? DurationSeconds { get; set; }
    public List<TestResultReviewItemDto> ReviewQuestions { get; set; } = new();
    public List<TestResultReviewItemDto> IncorrectQuestions { get; set; } = new();
}

public class PlayerTestHistoryItemDto
{
    public int AttemptId { get; set; }
    public int QuizId { get; set; }
    public string QuizTitle { get; set; } = string.Empty;
    public string? ParticipantName { get; set; }
    public int TotalScore { get; set; }
    public int TotalQuestions { get; set; }
    public int AnsweredQuestions { get; set; }
    public int CorrectAnswers { get; set; }
    public int WrongAnswers { get; set; }
    public double AccuracyPercent { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int? DurationSeconds { get; set; }
}
