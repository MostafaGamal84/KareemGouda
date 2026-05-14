using API.DTOs.QuizGame;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.QuizGame;

[ApiController]
[Route("api/quiz-access")]
public class QuizAccessController : ControllerBase
{
    private readonly IQuizAccessService _service;

    public QuizAccessController(IQuizAccessService service)
    {
        _service = service;
    }

    [HttpGet("quiz/{quizId:int}")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> GetByQuizId(int quizId)
    {
        var access = await _service.GetByQuizIdAsync(quizId);
        return access is null ? NotFound(new { message = "Quiz access not found" }) : Ok(access);
    }

    [HttpPost("quiz/{quizId:int}")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> CreateOrUpdate(int quizId, [FromBody] QuizAccessCreateUpdateDto dto)
    {
        var result = await _service.CreateOrUpdateAsync(quizId, dto);
        return Ok(result);
    }

    [HttpPost("quiz/{quizId:int}/users")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> AddUsers(int quizId, [FromBody] QuizAccessAddUsersDto dto)
    {
        var result = await _service.AddUsersAsync(quizId, dto);
        return result is null ? NotFound(new { message = "Quiz access not found" }) : Ok(result);
    }

    [HttpDelete("quiz/{quizId:int}/users/{userAccessId:int}")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> RemoveUser(int quizId, int userAccessId)
    {
        var result = await _service.RemoveUserAsync(quizId, userAccessId);
        return result is null ? NotFound(new { message = "User access not found" }) : Ok(result);
    }

    [HttpPut("quiz/{quizId:int}/users/{userAccessId:int}/status")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> UpdateUserStatus(int quizId, int userAccessId, [FromBody] QuizAccessUpdateUserStatusDto dto)
    {
        var result = await _service.UpdateUserStatusAsync(quizId, userAccessId, dto);
        return result is null ? NotFound(new { message = "User access not found" }) : Ok(result);
    }

    [HttpPost("quiz/{quizId:int}/groups")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> AddGroups(int quizId, [FromBody] QuizAccessAddGroupsDto dto)
    {
        var result = await _service.AddGroupsAsync(quizId, dto);
        return result is null ? NotFound(new { message = "Quiz access not found" }) : Ok(result);
    }

    [HttpDelete("quiz/{quizId:int}/groups/{groupAccessId:int}")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> RemoveGroup(int quizId, int groupAccessId)
    {
        var result = await _service.RemoveGroupAsync(quizId, groupAccessId);
        return result is null ? NotFound(new { message = "Group access not found" }) : Ok(result);
    }

    [HttpPost("quiz/{quizId:int}/extra-attempts")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> ApproveExtraAttempts(int quizId, [FromBody] QuizAccessApproveExtraAttemptsDto dto)
    {
        var result = await _service.ApproveExtraAttemptsAsync(quizId, dto);
        return result ? Ok(new { message = "Extra attempts approved" }) : NotFound(new { message = "User access not found" });
    }

    [HttpGet("quiz/{quizId:int}/check")]
    [Authorize(Roles = "Player")]
    public async Task<IActionResult> CheckAttempt(int quizId)
    {
        var userId = GetUserIdFromClaims();
        if (userId == 0) return Unauthorized();

        var result = await _service.CheckAttemptAsync(quizId, userId);
        return Ok(result);
    }

    [HttpGet("quiz/{quizId:int}/available-students")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> GetAvailableStudents(int quizId)
    {
        var students = await _service.GetAvailableStudentsAsync(quizId);
        return Ok(students);
    }

    [HttpGet("quiz/{quizId:int}/available-groups")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> GetAvailableGroups(int quizId)
    {
        var groups = await _service.GetAvailableGroupsAsync(quizId);
        return Ok(groups);
    }

    private int GetUserIdFromClaims()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
        {
            return 0;
        }
        return userId;
    }
}
