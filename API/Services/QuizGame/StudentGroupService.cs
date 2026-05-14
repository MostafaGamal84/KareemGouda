using API.Data;
using API.DTOs.QuizGame;
using API.Entities;
using API.Entities.QuizGame;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Services.QuizGame;

public class StudentGroupService : IStudentGroupService
{
    private readonly DataContext _context;
    private readonly UserManager<AppUser> _userManager;

    public StudentGroupService(DataContext context, UserManager<AppUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    public async Task<PagedResultDto<StudentGroupDto>> GetAllAsync(StudentQueryDto query)
    {
        var queryable = _context.StudentGroups
            .Where(x => !x.IsDeleted)
            .Include(x => x.Members)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchTerm = query.Search.ToLower();
            queryable = queryable.Where(x => x.Name.ToLower().Contains(searchTerm) ||
                                            (x.Description != null && x.Description.ToLower().Contains(searchTerm)));
        }

        var totalCount = await queryable.CountAsync();
        var items = await queryable
            .OrderByDescending(x => x.CreatedAt)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new StudentGroupDto
            {
                Id = x.Id,
                Name = x.Name,
                Description = x.Description,
                MembersCount = x.Members.Count,
                ActiveMembersCount = x.Members.Count(m => m.Status == StudentStatus.Active),
                PendingMembersCount = x.Members.Count(m => m.Status == StudentStatus.Pending),
                CreatedAt = x.CreatedAt
            })
            .ToListAsync();

        return new PagedResultDto<StudentGroupDto>
        {
            PageNumber = query.PageNumber,
            PageSize = query.PageSize,
            TotalCount = totalCount,
            Items = items
        };
    }

    public async Task<StudentGroupDto?> GetByIdAsync(int id)
    {
        var group = await _context.StudentGroups
            .Where(x => !x.IsDeleted && x.Id == id)
            .Include(x => x.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync();

        if (group == null) return null;

        return MapToDto(group);
    }

    public async Task<StudentGroupDto> CreateAsync(StudentGroupCreateUpdateDto dto, int userId)
    {
        var group = new StudentGroup
        {
            Name = dto.Name,
            Description = dto.Description,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.StudentGroups.Add(group);
        await _context.SaveChangesAsync();

        return new StudentGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            MembersCount = 0,
            ActiveMembersCount = 0,
            PendingMembersCount = 0,
            CreatedAt = group.CreatedAt
        };
    }

    public async Task<StudentGroupDto?> UpdateAsync(int id, StudentGroupCreateUpdateDto dto)
    {
        var group = await _context.StudentGroups
            .Where(x => !x.IsDeleted && x.Id == id)
            .FirstOrDefaultAsync();

        if (group == null) return null;

        group.Name = dto.Name;
        group.Description = dto.Description;

        await _context.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var group = await _context.StudentGroups
            .Where(x => !x.IsDeleted && x.Id == id)
            .FirstOrDefaultAsync();

        if (group == null) return false;

        group.IsDeleted = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<StudentGroupDto?> AddMembersAsync(int id, StudentGroupAddMembersDto dto)
    {
        var group = await _context.StudentGroups
            .Where(x => !x.IsDeleted && x.Id == id)
            .Include(x => x.Members)
            .FirstOrDefaultAsync();

        if (group == null) return null;

        var existingMemberIds = group.Members.Select(m => m.UserId).ToList();
        var newUserIds = dto.UserIds.Except(existingMemberIds).ToList();

        var users = await _userManager.Users
            .Where(u => newUserIds.Contains(u.Id))
            .Where(u => u.UserRoles.Any(ur => ur.Role.Name == "Player"))
            .ToListAsync();

        foreach (var user in users)
        {
            var member = new StudentGroupMember
            {
                StudentGroupId = id,
                UserId = user.Id,
                Status = StudentStatus.Active,
                JoinedAt = DateTime.UtcNow
            };
            _context.StudentGroupMembers.Add(member);
        }

        await _context.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<StudentGroupDto?> RemoveMemberAsync(int id, int memberId)
    {
        var member = await _context.StudentGroupMembers
            .Where(x => x.StudentGroupId == id && x.Id == memberId)
            .FirstOrDefaultAsync();

        if (member == null) return null;

        _context.StudentGroupMembers.Remove(member);
        await _context.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<StudentGroupDto?> UpdateMemberStatusAsync(int id, int memberId, StudentGroupUpdateMemberStatusDto dto)
    {
        var member = await _context.StudentGroupMembers
            .Where(x => x.StudentGroupId == id && x.Id == memberId)
            .FirstOrDefaultAsync();

        if (member == null) return null;

        member.Status = (StudentStatus)dto.Status;
        await _context.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<PagedResultDto<StudentListDto>> GetStudentsAsync(StudentQueryDto query)
    {
        var queryable = _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Include(u => u.GroupMemberships)
                .ThenInclude(m => m.StudentGroup)
            .Where(u => !u.IsDeleted)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Role))
        {
            var normalizedRole = query.Role.Trim().ToLower();
            queryable = queryable.Where(u => u.UserRoles.Any(ur => ur.Role.Name.ToLower() == normalizedRole));
        }

        if (query.Status.HasValue)
        {
            queryable = queryable.Where(u => u.Status == query.Status.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchTerm = query.Search.ToLower();
            queryable = queryable.Where(u => 
                (u.UserName != null && u.UserName.ToLower().Contains(searchTerm)) ||
                (u.Email != null && u.Email.ToLower().Contains(searchTerm)) ||
                (u.FirstName != null && u.FirstName.ToLower().Contains(searchTerm)) ||
                (u.LastName != null && u.LastName.ToLower().Contains(searchTerm)));
        }

        if (query.GroupId.HasValue)
        {
            queryable = queryable.Where(u => u.GroupMemberships
                .Any(m => !m.IsDeleted && m.StudentGroupId == query.GroupId.Value));
        }

        var totalCount = await queryable.CountAsync();
        var items = await queryable
            .OrderByDescending(u => u.RegisterTime)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(u => new StudentListDto
            {
                Id = u.Id,
                UserName = u.UserName ?? "",
                Email = u.Email ?? "",
                FirstName = u.FirstName,
                LastName = u.LastName,
                Role = u.UserRoles
                    .Select(ur => ur.Role.Name)
                    .FirstOrDefault() ?? string.Empty,
                Status = u.Status,
                StatusName = ((StudentStatus)u.Status).ToString(),
                RegisterTime = u.RegisterTime,
                Groups = u.GroupMemberships
                    .Where(m => !m.IsDeleted)
                    .Select(m => m.StudentGroup.Name)
                    .ToList()
            })
            .ToListAsync();

        return new PagedResultDto<StudentListDto>
        {
            PageNumber = query.PageNumber,
            PageSize = query.PageSize,
            TotalCount = totalCount,
            Items = items
        };
    }

    public async Task<bool> ApproveStudentAsync(int userId, StudentApprovalDto dto)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null) return false;

        user.Status = dto.Status;

        var result = await _userManager.UpdateAsync(user);
        return result.Succeeded;
    }

    private StudentGroupDto MapToDto(StudentGroup group)
    {
        return new StudentGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            MembersCount = group.Members.Count,
            ActiveMembersCount = group.Members.Count(m => m.Status == StudentStatus.Active),
            PendingMembersCount = group.Members.Count(m => m.Status == StudentStatus.Pending),
            CreatedAt = group.CreatedAt,
            Members = group.Members.Select(m => new StudentGroupMemberDto
            {
                Id = m.Id,
                UserId = m.UserId,
                UserName = m.User?.UserName ?? "",
                Email = m.User?.Email ?? "",
                FirstName = m.User?.FirstName,
                LastName = m.User?.LastName,
                Status = (int)m.Status,
                StatusName = m.Status.ToString(),
                JoinedAt = m.JoinedAt
            }).ToList()
        };
    }
}
