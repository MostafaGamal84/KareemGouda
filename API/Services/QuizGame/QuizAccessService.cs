using API.Data;
using API.DTOs.QuizGame;
using API.Entities;
using API.Entities.QuizGame;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Services.QuizGame;

public class QuizAccessService : IQuizAccessService
{
    private readonly DataContext _context;
    private readonly UserManager<AppUser> _userManager;

    public QuizAccessService(DataContext context, UserManager<AppUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    public async Task<QuizAccessDto?> GetByQuizIdAsync(int quizId)
    {
        var access = await _context.QuizAccesses
            .Where(x => !x.IsDeleted && x.QuizId == quizId)
            .Include(x => x.AccessUsers)
                .ThenInclude(u => u.User)
            .Include(x => x.AccessGroups)
                .ThenInclude(g => g.StudentGroup)
            .FirstOrDefaultAsync();

        if (access == null) return null;
        return MapToDto(access);
    }

    public async Task<QuizAccessDto> CreateOrUpdateAsync(int quizId, QuizAccessCreateUpdateDto dto)
    {
        var access = await _context.QuizAccesses
            .Where(x => !x.IsDeleted && x.QuizId == quizId)
            .FirstOrDefaultAsync();

        var resolvedAccessType = dto.ExamMode == ExamMode.Live ? ExamAccessType.Public : dto.AccessType;

        if (access == null)
        {
            access = new QuizAccess
            {
                QuizId = quizId,
                ExamMode = dto.ExamMode,
                AccessType = resolvedAccessType,
                MaxAttempts = dto.MaxAttempts,
                ScheduledStartTime = dto.ScheduledStartTime,
                ScheduledEndTime = dto.ScheduledEndTime,
                TimerMinutes = dto.TimerMinutes
            };
            _context.QuizAccesses.Add(access);
        }
        else
        {
            access.ExamMode = dto.ExamMode;
            access.AccessType = resolvedAccessType;
            access.MaxAttempts = dto.MaxAttempts;
            access.ScheduledStartTime = dto.ScheduledStartTime;
            access.ScheduledEndTime = dto.ScheduledEndTime;
            access.TimerMinutes = dto.TimerMinutes;
        }

        await _context.SaveChangesAsync();
        return await GetByQuizIdAsync(quizId) ?? new QuizAccessDto();
    }

    public async Task<QuizAccessDto?> AddUsersAsync(int quizId, QuizAccessAddUsersDto dto)
    {
        var access = await _context.QuizAccesses
            .Where(x => !x.IsDeleted && x.QuizId == quizId)
            .Include(x => x.AccessUsers)
            .FirstOrDefaultAsync();

        if (access == null) return null;

        var existingUserIds = access.AccessUsers.Select(u => u.UserId).ToList();
        var newUserIds = dto.UserIds.Except(existingUserIds).ToList();

        var users = await _userManager.Users
            .Where(u => newUserIds.Contains(u.Id))
            .ToListAsync();

        foreach (var user in users)
        {
            var accessUser = new QuizAccessUser
            {
                QuizAccessId = access.Id,
                UserId = user.Id,
                Status = AccessRequestStatus.Approved,
                RequestedAt = DateTime.UtcNow,
                ApprovedAt = DateTime.UtcNow,
                AttemptCount = 0
            };
            _context.QuizAccessUsers.Add(accessUser);
        }

        await _context.SaveChangesAsync();
        return await GetByQuizIdAsync(quizId);
    }

    public async Task<QuizAccessDto?> RemoveUserAsync(int quizId, int userAccessId)
    {
        var accessUser = await _context.QuizAccessUsers
            .Include(x => x.QuizAccess)
            .Where(x => x.QuizAccess.QuizId == quizId && x.Id == userAccessId)
            .FirstOrDefaultAsync();

        if (accessUser == null) return null;

        _context.QuizAccessUsers.Remove(accessUser);
        await _context.SaveChangesAsync();
        return await GetByQuizIdAsync(quizId);
    }

    public async Task<QuizAccessDto?> UpdateUserStatusAsync(int quizId, int userAccessId, QuizAccessUpdateUserStatusDto dto)
    {
        var accessUser = await _context.QuizAccessUsers
            .Include(x => x.QuizAccess)
            .Where(x => x.QuizAccess.QuizId == quizId && x.Id == userAccessId)
            .FirstOrDefaultAsync();

        if (accessUser == null) return null;

        accessUser.Status = (AccessRequestStatus)dto.Status;
        await _context.SaveChangesAsync();
        return await GetByQuizIdAsync(quizId);
    }

    public async Task<QuizAccessDto?> AddGroupsAsync(int quizId, QuizAccessAddGroupsDto dto)
    {
        var access = await _context.QuizAccesses
            .Where(x => !x.IsDeleted && x.QuizId == quizId)
            .Include(x => x.AccessGroups)
            .FirstOrDefaultAsync();

        if (access == null) return null;

        var existingGroupIds = access.AccessGroups.Select(g => g.StudentGroupId).ToList();
        var newGroupIds = dto.GroupIds.Except(existingGroupIds).ToList();

        var groups = await _context.StudentGroups
            .Where(g => !g.IsDeleted && newGroupIds.Contains(g.Id))
            .ToListAsync();

        foreach (var group in groups)
        {
            var accessGroup = new QuizAccessGroup
            {
                QuizAccessId = access.Id,
                StudentGroupId = group.Id
            };
            _context.QuizAccessGroups.Add(accessGroup);
        }

        await _context.SaveChangesAsync();
        return await GetByQuizIdAsync(quizId);
    }

    public async Task<QuizAccessDto?> RemoveGroupAsync(int quizId, int groupAccessId)
    {
        var accessGroup = await _context.QuizAccessGroups
            .Include(x => x.QuizAccess)
            .Where(x => x.QuizAccess.QuizId == quizId && x.Id == groupAccessId)
            .FirstOrDefaultAsync();

        if (accessGroup == null) return null;

        _context.QuizAccessGroups.Remove(accessGroup);
        await _context.SaveChangesAsync();
        return await GetByQuizIdAsync(quizId);
    }

    public async Task<bool> ApproveExtraAttemptsAsync(int quizId, QuizAccessApproveExtraAttemptsDto dto)
    {
        var accessUser = await _context.QuizAccessUsers
            .Include(x => x.QuizAccess)
            .Where(x => x.QuizAccess.QuizId == quizId && x.UserId == dto.UserId)
            .FirstOrDefaultAsync();

        if (accessUser == null) return false;

        accessUser.ExtraAttemptsApproved = true;
        accessUser.ExtraAttemptsApprovedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<AttemptCheckResultDto> CheckAttemptAsync(int quizId, int userId)
    {
        var result = new AttemptCheckResultDto();
        var now = DateTime.UtcNow;

        var access = await _context.QuizAccesses
            .Where(x => !x.IsDeleted && x.QuizId == quizId)
            .FirstOrDefaultAsync();

        if (access == null)
        {
            result.CanStart = false;
            result.BlockReason = "Exam access is not configured";
            return result;
        }

        result.MaxAttempts = access.MaxAttempts;
        result.ScheduledStartTime = access.ScheduledStartTime;
        result.ScheduledEndTime = access.ScheduledEndTime;
        result.TimerMinutes = access.TimerMinutes;

        if (access.ScheduledStartTime.HasValue && now < access.ScheduledStartTime.Value)
        {
            result.CanStart = false;
            result.BlockReason = $"Exam starts at {access.ScheduledStartTime.Value:yyyy-MM-dd HH:mm}";
            return result;
        }

        if (access.ScheduledEndTime.HasValue && now > access.ScheduledEndTime.Value)
        {
            result.CanStart = false;
            result.BlockReason = "Exam has ended";
            return result;
        }

        if (access.AccessType == ExamAccessType.Custom)
        {
            var accessUser = await _context.QuizAccessUsers
                .Where(x => x.QuizAccessId == access.Id && x.UserId == userId)
                .FirstOrDefaultAsync();

            if (accessUser is { Status: AccessRequestStatus.Approved })
            {
                result.AttemptCount = accessUser.AttemptCount;
                result.ExtraAttemptsApproved = accessUser.ExtraAttemptsApproved;

                if (!result.ExtraAttemptsApproved && accessUser.AttemptCount >= access.MaxAttempts)
                {
                    result.CanStart = false;
                    result.BlockReason = "You have exhausted all attempts. Please contact your teacher.";
                    return result;
                }

                result.RemainingAttempts = result.ExtraAttemptsApproved
                    ? int.MaxValue
                    : access.MaxAttempts - accessUser.AttemptCount;
                result.CanStart = true;
                return result;
            }

            if (accessUser is { Status: AccessRequestStatus.Pending })
            {
                result.CanStart = false;
                result.BlockReason = "Your registration is pending approval";
                return result;
            }

            var inGroup = await (
                from g in _context.Set<QuizAccessGroup>()
                join m in _context.Set<StudentGroupMember>() on g.StudentGroupId equals m.StudentGroupId
                where !g.IsDeleted &&
                      g.QuizAccessId == access.Id &&
                      !m.IsDeleted &&
                      m.UserId == userId &&
                      m.Status == StudentStatus.Active
                select g.Id).AnyAsync();

            if (inGroup)
            {
                var finishedAttempts = await _context.Set<QuizAttempt>()
                    .CountAsync(x => x.QuizId == quizId && x.UserId == userId && !x.IsDeleted && x.IsFinished);

                result.AttemptCount = finishedAttempts;
                result.ExtraAttemptsApproved = false;

                if (finishedAttempts >= access.MaxAttempts)
                {
                    result.CanStart = false;
                    result.BlockReason = "You have exhausted all attempts. Please contact your teacher.";
                    return result;
                }

                result.RemainingAttempts = access.MaxAttempts - finishedAttempts;
                result.CanStart = true;
                return result;
            }

            result.CanStart = false;
            result.BlockReason = "You are not registered for this exam";
            return result;
        }

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            result.CanStart = false;
            result.BlockReason = "User not found";
            return result;
        }

        if (user.Status != 1)
        {
            result.CanStart = false;
            result.BlockReason = "Your account is not active";
            return result;
        }

        var existingAttempt = await _context.QuizAttempts
            .Where(x => x.QuizId == quizId && x.UserId == userId && !x.IsFinished)
            .FirstOrDefaultAsync();

        if (existingAttempt != null)
        {
            result.AttemptCount = existingAttempt.Id > 0 ? 1 : 0;
        }

        result.CanStart = true;
        result.RemainingAttempts = access.MaxAttempts;
        return result;
    }

    public async Task<List<UserSummaryDto>> GetAvailableStudentsAsync(int quizId)
    {
        var access = await _context.QuizAccesses
            .Where(x => !x.IsDeleted && x.QuizId == quizId)
            .Include(x => x.AccessUsers)
            .FirstOrDefaultAsync();

        var existingUserIds = access?.AccessUsers.Select(u => u.UserId).ToList() ?? new List<int>();

        var students = await _userManager.GetUsersInRoleAsync("Player");
        var filteredStudents = students
            .Where(s => !existingUserIds.Contains(s.Id) && s.Status == 1)
            .Select(s => new UserSummaryDto
            {
                Id = s.Id,
                UserName = s.UserName ?? "",
                Email = s.Email ?? "",
                FirstName = s.FirstName,
                LastName = s.LastName,
                Status = s.Status
            })
            .ToList();

        return filteredStudents;
    }

    public async Task<List<StudentGroupDto>> GetAvailableGroupsAsync(int quizId)
    {
        var access = await _context.QuizAccesses
            .Where(x => !x.IsDeleted && x.QuizId == quizId)
            .Include(x => x.AccessGroups)
            .FirstOrDefaultAsync();

        var existingGroupIds = access?.AccessGroups.Select(g => g.StudentGroupId).ToList() ?? new List<int>();

        var groups = await _context.StudentGroups
            .Where(g => !g.IsDeleted && !existingGroupIds.Contains(g.Id))
            .Include(g => g.Members)
            .Select(g => new StudentGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                Description = g.Description,
                MembersCount = g.Members.Count,
                ActiveMembersCount = g.Members.Count(m => m.Status == StudentStatus.Active),
                PendingMembersCount = g.Members.Count(m => m.Status == StudentStatus.Pending),
                CreatedAt = g.CreatedAt
            })
            .ToListAsync();

        return groups;
    }

    private QuizAccessDto MapToDto(QuizAccess access)
    {
        return new QuizAccessDto
        {
            Id = access.Id,
            QuizId = access.QuizId,
            ExamMode = access.ExamMode,
            ExamModeName = access.ExamMode.ToString(),
            AccessType = access.AccessType,
            AccessTypeName = access.AccessType.ToString(),
            MaxAttempts = access.MaxAttempts,
            ScheduledStartTime = access.ScheduledStartTime,
            ScheduledEndTime = access.ScheduledEndTime,
            TimerMinutes = access.TimerMinutes,
            AccessUsers = access.AccessUsers.Select(u => new QuizAccessUserDto
            {
                Id = u.Id,
                UserId = u.UserId,
                UserName = u.User?.UserName ?? "",
                Email = u.User?.Email ?? "",
                FirstName = u.User?.FirstName,
                LastName = u.User?.LastName,
                Status = u.Status,
                StatusName = u.Status.ToString(),
                RequestedAt = u.RequestedAt,
                ApprovedAt = u.ApprovedAt,
                AttemptCount = u.AttemptCount,
                ExtraAttemptsApproved = u.ExtraAttemptsApproved,
                ExtraAttemptsApprovedAt = u.ExtraAttemptsApprovedAt
            }).ToList(),
            AccessGroups = access.AccessGroups.Select(g => new QuizAccessGroupDto
            {
                Id = g.Id,
                StudentGroupId = g.StudentGroupId,
                GroupName = g.StudentGroup?.Name ?? "",
                MembersCount = g.StudentGroup?.Members.Count ?? 0
            }).ToList()
        };
    }
}
