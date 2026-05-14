using API.Entities.QuizGame;

namespace API.DTOs.QuizGame;

public class QuizAccessDto
{
    public int Id { get; set; }
    public int QuizId { get; set; }
    public ExamMode ExamMode { get; set; }
    public string ExamModeName { get; set; } = string.Empty;
    public ExamAccessType AccessType { get; set; }
    public string AccessTypeName { get; set; } = string.Empty;
    public int MaxAttempts { get; set; }
    public DateTime? ScheduledStartTime { get; set; }
    public DateTime? ScheduledEndTime { get; set; }
    public int? TimerMinutes { get; set; }
    public List<QuizAccessUserDto> AccessUsers { get; set; } = new();
    public List<QuizAccessGroupDto> AccessGroups { get; set; } = new();
}

public class QuizAccessUserDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public AccessRequestStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public DateTime RequestedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public int AttemptCount { get; set; }
    public bool ExtraAttemptsApproved { get; set; }
    public DateTime? ExtraAttemptsApprovedAt { get; set; }
}

public class QuizAccessGroupDto
{
    public int Id { get; set; }
    public int StudentGroupId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public int MembersCount { get; set; }
}

public class QuizAccessCreateUpdateDto
{
    public ExamMode ExamMode { get; set; } = ExamMode.Test;
    public ExamAccessType AccessType { get; set; } = ExamAccessType.Public;
    public int MaxAttempts { get; set; } = 1;
    public DateTime? ScheduledStartTime { get; set; }
    public DateTime? ScheduledEndTime { get; set; }
    public int? TimerMinutes { get; set; }
}

public class QuizAccessAddUsersDto
{
    public List<int> UserIds { get; set; } = new();
}

public class QuizAccessAddGroupsDto
{
    public List<int> GroupIds { get; set; } = new();
}

public class QuizAccessUpdateUserStatusDto
{
    public int Status { get; set; }
}

public class QuizAccessApproveExtraAttemptsDto
{
    public int UserId { get; set; }
}

public class QuizAccessUserStatusDto
{
    public int QuizId { get; set; }
    public int UserId { get; set; }
    public AccessRequestStatus Status { get; set; }
    public int AttemptCount { get; set; }
    public int MaxAttempts { get; set; }
    public bool ExtraAttemptsApproved { get; set; }
    public DateTime? ScheduledStartTime { get; set; }
    public DateTime? ScheduledEndTime { get; set; }
    public int? TimerMinutes { get; set; }
    public bool CanStart { get; set; }
    public string? BlockReason { get; set; }
}

public class AttemptCheckResultDto
{
    public bool CanStart { get; set; }
    public string? BlockReason { get; set; }
    public int AttemptCount { get; set; }
    public int MaxAttempts { get; set; }
    public int RemainingAttempts { get; set; }
    public bool ExtraAttemptsApproved { get; set; }
    public DateTime? ScheduledStartTime { get; set; }
    public DateTime? ScheduledEndTime { get; set; }
    public int? TimerMinutes { get; set; }
}

public class QuestionWithQuizAssignmentDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public QuestionType Type { get; set; }
    public QuestionSelectionMode SelectionMode { get; set; }
    public string? Difficulty { get; set; }
    public int Points { get; set; }
    public int AnswerSeconds { get; set; }
    public string? ImageUrl { get; set; }
    public int? QuizId { get; set; }
    public string? QuizTitle { get; set; }
    public bool IsOwnedByQuiz { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<QuestionChoiceDto> Choices { get; set; } = new();
}
