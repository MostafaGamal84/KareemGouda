using Entities;

namespace API.Entities.QuizGame;

public enum ExamMode
{
    Live = 1,
    Test = 2
}

public enum ExamAccessType
{
    Public = 1,
    Custom = 2
}

public enum StudentStatus
{
    Pending = 0,
    Active = 1,
    Rejected = 2
}

public enum AccessRequestStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3
}

public class StudentGroup : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public virtual ICollection<StudentGroupMember> Members { get; set; } = new List<StudentGroupMember>();
}

public class StudentGroupMember : BaseEntity
{
    public int StudentGroupId { get; set; }
    public int UserId { get; set; }
    public StudentStatus Status { get; set; } = StudentStatus.Pending;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public virtual StudentGroup StudentGroup { get; set; } = null!;
    public virtual AppUser User { get; set; } = null!;
}

public class QuizAccess : BaseEntity
{
    public int QuizId { get; set; }
    public ExamMode ExamMode { get; set; } = ExamMode.Test;
    public ExamAccessType AccessType { get; set; } = ExamAccessType.Public;
    public int MaxAttempts { get; set; } = 1;
    public DateTime? ScheduledStartTime { get; set; }
    public DateTime? ScheduledEndTime { get; set; }
    public int? TimerMinutes { get; set; }
    public virtual Quiz Quiz { get; set; } = null!;
    public virtual ICollection<QuizAccessUser> AccessUsers { get; set; } = new List<QuizAccessUser>();
    public virtual ICollection<QuizAccessGroup> AccessGroups { get; set; } = new List<QuizAccessGroup>();
}

public class QuizAccessUser : BaseEntity
{
    public int QuizAccessId { get; set; }
    public int UserId { get; set; }
    public AccessRequestStatus Status { get; set; } = AccessRequestStatus.Pending;
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedAt { get; set; }
    public int? ApprovedBy { get; set; }
    public int AttemptCount { get; set; } = 0;
    public bool ExtraAttemptsApproved { get; set; } = false;
    public DateTime? ExtraAttemptsApprovedAt { get; set; }
    public int? ExtraAttemptsApprovedBy { get; set; }
    public virtual QuizAccess QuizAccess { get; set; } = null!;
    public virtual AppUser User { get; set; } = null!;
}

public class QuizAccessGroup : BaseEntity
{
    public int QuizAccessId { get; set; }
    public int StudentGroupId { get; set; }
    public virtual QuizAccess QuizAccess { get; set; } = null!;
    public virtual StudentGroup StudentGroup { get; set; } = null!;
}
