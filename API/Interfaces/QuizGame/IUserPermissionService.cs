using API.Entities;

namespace API.Interfaces.QuizGame;

public interface IUserPermissionService
{
    Task<List<UserPermission>> GetUserPermissionsAsync(int userId);
    Task<List<UserPermission>> GetAllUsersWithPermissionsAsync();
    Task<bool> SetPermissionAsync(int userId, Permission permission, bool isGranted, int grantedBy);
    Task<bool> BulkSetPermissionsAsync(int userId, Dictionary<Permission, bool> permissions, int grantedBy);
    Task<bool> BulkSetPermissionsForUsersAsync(List<int> userIds, Dictionary<Permission, bool> permissions, int grantedBy);
    Task<bool> HasPermissionAsync(int userId, Permission permission);
    Task<Dictionary<Permission, bool>> GetUserPermissionsDictAsync(int userId);
}
