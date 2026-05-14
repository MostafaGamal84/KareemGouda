namespace API.DTOs.QuizGame;

public class StudentGroupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MembersCount { get; set; }
    public int ActiveMembersCount { get; set; }
    public int PendingMembersCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<StudentGroupMemberDto> Members { get; set; } = new();
}

public class StudentGroupMemberDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; }
}

public class StudentGroupCreateUpdateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class StudentGroupAddMembersDto
{
    public List<int> UserIds { get; set; } = new();
}

public class StudentGroupUpdateMemberStatusDto
{
    public int Status { get; set; }
}

public class StudentListDto
{
    public int Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string Role { get; set; } = string.Empty;
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public DateTime RegisterTime { get; set; }
    public List<string> Groups { get; set; } = new();
}

public class StudentApprovalDto
{
    public int UserId { get; set; }
    public int Status { get; set; }
    public string? DecisionNote { get; set; }
}

public class StudentQueryDto : PagedRequestDto
{
    public int? Status { get; set; }
    public int? GroupId { get; set; }
    public string? Role { get; set; }
}

public class UserSummaryDto
{
    public int Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public int Status { get; set; }
}
