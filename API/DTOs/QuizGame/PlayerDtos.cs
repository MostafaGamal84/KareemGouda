namespace API.DTOs.QuizGame;
using API.Entities.QuizGame;

public class PlayerJoinDto
{
    public string? JoinCode { get; set; }
    public int? SessionId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    /// <summary>Required for public sessions (guest-friendly identification).</summary>
    public string? Email { get; set; }
}

public class PlayerJoinResponseDto
{
    public int ParticipantId { get; set; }
    public string ParticipantToken { get; set; } = string.Empty;
    public int SessionId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public ParticipantJoinStatus JoinStatus { get; set; }
    public bool RequiresApproval { get; set; }
    public DateTime? TestEndsAtUtc { get; set; }
}

public class WaitingRoomPlayerDto
{
    public string DisplayName { get; set; } = string.Empty;
    public string? Email { get; set; }
}

public class WaitingRoomDto
{
    public int SessionId { get; set; }
    public string SessionStatus { get; set; } = string.Empty;
    public string QuizTitle { get; set; } = string.Empty;
    public int ParticipantsCount { get; set; }
    public List<WaitingRoomPlayerDto> Players { get; set; } = new();
}

public class SubmitPlayerAnswerDto
{
    public int ParticipantId { get; set; }
    public string? ParticipantToken { get; set; }
    public int QuestionId { get; set; }
    public int? SelectedChoiceId { get; set; }
    public List<int> SelectedChoiceIds { get; set; } = new();
    public string? TextAnswer { get; set; }
    public long? ResponseTimeMs { get; set; }
}

public class PlayerAnswerSubmitResponseDto
{
    public bool Accepted { get; set; }
    public bool IsCorrect { get; set; }
    public int? SelectedChoiceId { get; set; }
    public List<int> SelectedChoiceIds { get; set; } = new();
    public int? CorrectChoiceId { get; set; }
    public List<int> CorrectChoiceIds { get; set; } = new();
    public bool ResultsDeferred { get; set; }
    public string? Message { get; set; }
}

public class PlayerSavedAnswerDto
{
    public int QuestionId { get; set; }
    public int? SelectedChoiceId { get; set; }
    public List<int> SelectedChoiceIds { get; set; } = new();
    public string? TextAnswer { get; set; }
}

public class LeaveSessionDto
{
    public int ParticipantId { get; set; }
    public string ParticipantToken { get; set; } = string.Empty;
}

public class ParticipantJoinStatusDto
{
    public int ParticipantId { get; set; }
    public int SessionId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public ParticipantJoinStatus JoinStatus { get; set; }
    public string? DecisionNote { get; set; }
}

public class ParticipantResultDto
{
    public int ParticipantId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public int TotalScore { get; set; }
    public int CorrectAnswers { get; set; }
    public int WrongAnswers { get; set; }
    public double AverageResponseTimeMs { get; set; }
}
