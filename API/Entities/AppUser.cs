using Microsoft.AspNetCore.Identity;
using API.Entities.QuizGame;

namespace API.Entities;

public class AppUser : IdentityUser<int>
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime RegisterTime { get; set; } = DateTime.UtcNow;
    public int Status { get; set; } = 1;
    public virtual ICollection<AppUserRole> UserRoles { get; set; } = new List<AppUserRole>();
    public virtual ICollection<StudentGroupMember> GroupMemberships { get; set; } = new List<StudentGroupMember>();
}
