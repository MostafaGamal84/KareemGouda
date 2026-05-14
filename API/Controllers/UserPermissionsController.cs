using API.DTOs.QuizGame;
using API.Data;
using API.Entities;
using API.Extensions;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers.QuizGame;

[ApiController]
[Route("api/permissions")]
[Authorize(Roles = "Admin")]
public class UserPermissionsController : ControllerBase
{
    private readonly IUserPermissionService _service;

    public UserPermissionsController(IUserPermissionService service)
    {
        _service = service;
    }

    [HttpGet("user/{userId:int}")]
    public async Task<IActionResult> GetUserPermissions(int userId)
    {
        var permissions = await _service.GetUserPermissionsDictAsync(userId);
        return Ok(permissions);
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsersWithPermissions()
    {
        var users = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Where(u => !u.IsDeleted)
            .Select(u => new
            {
                u.Id,
                u.UserName,
                u.Email,
                u.FirstName,
                u.LastName,
                u.Status,
                Role = u.UserRoles.Select(ur => ur.Role.Name).FirstOrDefault(),
                Permissions = _context.UserPermissions.Where(p => p.UserId == u.Id).ToList()
            })
            .ToListAsync();

        var result = new List<object>();
        foreach (var u in users)
        {
            var perms = new Dictionary<Permission, bool>();
            foreach (Permission p in Enum.GetValues<Permission>().Where(p => p != Permission.None))
            {
                var up = ((List<UserPermission>)u.Permissions).FirstOrDefault(x => x.Permission == p);
                perms[p] = up?.IsGranted ?? false;
            }
            result.Add(new
            {
                u.Id,
                u.UserName,
                u.Email,
                u.FirstName,
                u.LastName,
                u.Status,
                u.Role,
                Permissions = perms
            });
        }

        return Ok(result);
    }

    [HttpPost("user/{userId:int}")]
    public async Task<IActionResult> SetUserPermission(int userId, [FromBody] PermissionSetDto dto)
    {
        var ok = await _service.BulkSetPermissionsAsync(userId, dto.Permissions, User.GetUserId());
        return ok ? Ok(new { message = "Permissions updated" }) : BadRequest(new { message = "Failed to update permissions" });
    }

    [HttpPost("bulk")]
    public async Task<IActionResult> BulkSetPermissions([FromBody] BulkPermissionSetDto dto)
    {
        if (dto.UserIds is null || dto.UserIds.Count == 0)
            return BadRequest(new { message = "No users selected" });

        var ok = await _service.BulkSetPermissionsForUsersAsync(dto.UserIds, dto.Permissions, User.GetUserId());
        return ok ? Ok(new { message = "Permissions updated" }) : BadRequest(new { message = "Failed to update permissions" });
    }

    private DataContext _context => HttpContext.RequestServices.GetRequiredService<DataContext>();
}

public class PermissionSetDto
{
    public Dictionary<Permission, bool> Permissions { get; set; } = new();
}

public class BulkPermissionSetDto
{
    public List<int> UserIds { get; set; } = new();
    public Dictionary<Permission, bool> Permissions { get; set; } = new();
}
