using Microsoft.AspNetCore.Identity;

namespace API.Entities;

public class UserPermission
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public Permission Permission { get; set; }
    public bool IsGranted { get; set; }
    public int? GrantedBy { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    public virtual AppUser User { get; set; } = null!;
    public virtual AppUser? GrantedByUser { get; set; }
}

[Flags]
public enum Permission
{
    None = 0,
    AddQuestions = 1,
    EditQuestions = 2,
    DeleteQuestions = 4,
    AddTests = 8,
    EditTests = 16,
    DeleteTests = 32,
    ViewStudentResults = 64,
    ApproveRejectUsers = 128,
    AddRemoveStudentsToGroups = 256,
    ManageLiveClasses = 512
}