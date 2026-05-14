using API.Data;
using API.Entities;
using API.Interfaces.QuizGame;
using Microsoft.EntityFrameworkCore;

namespace API.Services.QuizGame;

public class UserPermissionService : IUserPermissionService
{
    private readonly DataContext _context;

    public UserPermissionService(DataContext context)
    {
        _context = context;
    }

    public async Task<List<UserPermission>> GetUserPermissionsAsync(int userId)
    {
        return await _context.UserPermissions
            .Where(x => x.UserId == userId)
            .ToListAsync();
    }

    public async Task<List<UserPermission>> GetAllUsersWithPermissionsAsync()
    {
        return await _context.UserPermissions
            .Include(x => x.User)
            .OrderBy(x => x.User.UserName)
            .ToListAsync();
    }

    public async Task<bool> SetPermissionAsync(int userId, Permission permission, bool isGranted, int grantedBy)
    {
        var existing = await _context.UserPermissions
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Permission == permission);

        if (existing is null)
        {
            if (isGranted)
            {
                _context.UserPermissions.Add(new UserPermission
                {
                    UserId = userId,
                    Permission = permission,
                    IsGranted = true,
                    GrantedBy = grantedBy,
                    GrantedAt = DateTime.UtcNow
                });
            }
        }
        else
        {
            existing.IsGranted = isGranted;
            existing.GrantedBy = grantedBy;
            existing.GrantedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> BulkSetPermissionsAsync(int userId, Dictionary<Permission, bool> permissions, int grantedBy)
    {
        foreach (var (permission, isGranted) in permissions)
        {
            var existing = await _context.UserPermissions
                .FirstOrDefaultAsync(x => x.UserId == userId && x.Permission == permission);

            if (existing is null)
            {
                if (isGranted)
                {
                    _context.UserPermissions.Add(new UserPermission
                    {
                        UserId = userId,
                        Permission = permission,
                        IsGranted = true,
                        GrantedBy = grantedBy,
                        GrantedAt = DateTime.UtcNow
                    });
                }
            }
            else
            {
                existing.IsGranted = isGranted;
                existing.GrantedBy = grantedBy;
                existing.GrantedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> BulkSetPermissionsForUsersAsync(List<int> userIds, Dictionary<Permission, bool> permissions, int grantedBy)
    {
        foreach (var userId in userIds.Distinct())
        {
            foreach (var (permission, isGranted) in permissions)
            {
                var existing = await _context.UserPermissions
                    .FirstOrDefaultAsync(x => x.UserId == userId && x.Permission == permission);

                if (existing is null)
                {
                    if (isGranted)
                    {
                        _context.UserPermissions.Add(new UserPermission
                        {
                            UserId = userId,
                            Permission = permission,
                            IsGranted = true,
                            GrantedBy = grantedBy,
                            GrantedAt = DateTime.UtcNow
                        });
                    }
                }
                else
                {
                    existing.IsGranted = isGranted;
                    existing.GrantedBy = grantedBy;
                    existing.GrantedAt = DateTime.UtcNow;
                }
            }
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> HasPermissionAsync(int userId, Permission permission)
    {
        var user = await _context.Users
            .Include(x => x.UserRoles)
            .ThenInclude(x => x.Role)
            .FirstOrDefaultAsync(x => x.Id == userId);

        if (user is null)
            return false;

        var isAdminOrHost = user.UserRoles.Any(ur => ur.Role.Name == "Admin" || ur.Role.Name == "Host");
        if (isAdminOrHost)
            return true;

        var userPermission = await _context.UserPermissions
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Permission == permission);

        return userPermission?.IsGranted ?? false;
    }

    public async Task<Dictionary<Permission, bool>> GetUserPermissionsDictAsync(int userId)
    {
        var user = await _context.Users
            .Include(x => x.UserRoles)
            .ThenInclude(x => x.Role)
            .FirstOrDefaultAsync(x => x.Id == userId);

        var result = new Dictionary<Permission, bool>();
        var allPermissions = Enum.GetValues<Permission>().Where(p => p != Permission.None);

        var isAdminOrHost = user?.UserRoles.Any(ur => ur.Role.Name == "Admin" || ur.Role.Name == "Host") ?? false;

        foreach (var perm in allPermissions)
        {
            if (isAdminOrHost)
            {
                result[perm] = true;
            }
            else
            {
                var userPerm = await _context.UserPermissions
                    .FirstOrDefaultAsync(x => x.UserId == userId && x.Permission == perm);
                result[perm] = userPerm?.IsGranted ?? false;
            }
        }

        return result;
    }
}
