using API.DTOs.QuizGame;
using API.Extensions;
using API.Interfaces.QuizGame;
using API.Services.QuizGame;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.QuizGame;

[ApiController]
[Route("api/student-groups")]
[Authorize(Roles = "Admin,Host")]
public class StudentGroupsController : ControllerBase
{
    private readonly IStudentGroupService _service;

    public StudentGroupsController(IStudentGroupService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] StudentQueryDto query)
    {
        return Ok(await _service.GetAllAsync(query));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var group = await _service.GetByIdAsync(id);
        return group is null ? NotFound(new { message = "Group not found" }) : Ok(group);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] StudentGroupCreateUpdateDto dto)
    {
        var result = await _service.CreateAsync(dto, User.GetUserId());
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] StudentGroupCreateUpdateDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        return result is null ? NotFound(new { message = "Group not found" }) : Ok(result);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? Ok(new { message = "Group deleted" }) : NotFound(new { message = "Group not found" });
    }

    [HttpPost("{id:int}/members")]
    public async Task<IActionResult> AddMembers(int id, [FromBody] StudentGroupAddMembersDto dto)
    {
        var result = await _service.AddMembersAsync(id, dto);
        return result is null ? NotFound(new { message = "Group not found" }) : Ok(result);
    }

    [HttpDelete("{id:int}/members/{memberId:int}")]
    public async Task<IActionResult> RemoveMember(int id, int memberId)
    {
        var result = await _service.RemoveMemberAsync(id, memberId);
        return result is null ? NotFound(new { message = "Group or member not found" }) : Ok(result);
    }

    [HttpPut("{id:int}/members/{memberId:int}/status")]
    public async Task<IActionResult> UpdateMemberStatus(int id, int memberId, [FromBody] StudentGroupUpdateMemberStatusDto dto)
    {
        var result = await _service.UpdateMemberStatusAsync(id, memberId, dto);
        return result is null ? NotFound(new { message = "Group or member not found" }) : Ok(result);
    }

    [HttpGet("students")]
    public async Task<IActionResult> GetStudents([FromQuery] StudentQueryDto query)
    {
        return Ok(await _service.GetStudentsAsync(query));
    }

    [HttpPost("students/approve")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> ApproveStudent([FromBody] StudentApprovalDto dto)
    {
        var userId = User.GetUserId();
        var result = await _service.ApproveStudentAsync(dto.UserId, dto);
        return result ? Ok(new { message = "Student status updated" }) : NotFound(new { message = "Student not found" });
    }

    [HttpPost("students/bulk-approve")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> BulkApproveStudents([FromBody] List<int> userIds)
    {
        if (userIds is null || userIds.Count == 0)
            return BadRequest(new { message = "No users provided" });

        var count = 0;
        foreach (var userId in userIds)
        {
            var result = await _service.ApproveStudentAsync(userId, new StudentApprovalDto { Status = 1 });
            if (result) count++;
        }

        return Ok(new { message = $"Approved {count} students", count });
    }

    [HttpPost("students/bulk-reject")]
    [Authorize(Roles = "Admin,Host")]
    public async Task<IActionResult> BulkRejectStudents([FromBody] List<int> userIds)
    {
        if (userIds is null || userIds.Count == 0)
            return BadRequest(new { message = "No users provided" });

        var count = 0;
        foreach (var userId in userIds)
        {
            var result = await _service.ApproveStudentAsync(userId, new StudentApprovalDto { Status = 2 });
            if (result) count++;
        }

        return Ok(new { message = $"Rejected {count} students", count });
    }
}
