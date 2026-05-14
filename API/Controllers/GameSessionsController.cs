using API.DTOs.QuizGame;
using API.Extensions;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.QuizGame;

[ApiController]
[Route("api/game-sessions")]
public class GameSessionsController : ControllerBase
{
    private readonly IGameSessionService _service;

    public GameSessionsController(IGameSessionService service)
    {
        _service = service;
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGameSessionDto dto)
    {
        try
        {
            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var created = await _service.CreateAsync(dto, User.GetUserId(), baseUrl);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        return Ok(await _service.GetAllAsync());
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var session = await _service.GetByIdAsync(id);
        return session is null ? NotFound(new { message = "Session not found" }) : Ok(session);
    }

    [AllowAnonymous]
    [HttpGet("by-code/{joinCode}")]
    public async Task<IActionResult> GetByCode(string joinCode)
    {
        var session = await _service.GetByCodeAsync(joinCode);
        return session is null ? NotFound(new { message = "Session not found" }) : Ok(session);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/start")]
    public async Task<IActionResult> Start(int id)
    {
        var state = await _service.StartAsync(id);
        return state is null ? NotFound(new { message = "Session not found" }) : Ok(state);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/pause")]
    public async Task<IActionResult> Pause(int id)
    {
        var state = await _service.PauseAsync(id);
        return state is null ? NotFound(new { message = "Session not found" }) : Ok(state);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/resume")]
    public async Task<IActionResult> Resume(int id)
    {
        var state = await _service.ResumeAsync(id);
        return state is null ? NotFound(new { message = "Session not found" }) : Ok(state);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/end")]
    public async Task<IActionResult> End(int id)
    {
        var state = await _service.EndAsync(id);
        return state is null ? NotFound(new { message = "Session not found" }) : Ok(state);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/next-question")]
    public async Task<IActionResult> NextQuestion(int id)
    {
        try
        {
            var state = await _service.NextQuestionAsync(id);
            return state is null ? NotFound(new { message = "Session not found" }) : Ok(state);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [AllowAnonymous]
    [HttpGet("{id:int}/state")]
    public async Task<IActionResult> State(int id)
    {
        var state = await _service.GetStateAsync(id);
        return state is null ? NotFound(new { message = "Session not found" }) : Ok(state);
    }

    [AllowAnonymous]
    [HttpGet("{id:int}/leaderboard")]
    public async Task<IActionResult> Leaderboard(int id)
    {
        return Ok(await _service.GetLeaderboardAsync(id));
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ok = await _service.DeleteAsync(id);
        return ok ? Ok(new { message = "Session deleted successfully" }) : NotFound(new { message = "Session not found" });
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("{id:int}/join-requests")]
    public async Task<IActionResult> JoinRequests(int id)
    {
        return Ok(await _service.GetJoinRequestsAsync(id));
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/join-requests/{participantId:int}/approve")]
    public async Task<IActionResult> ApproveJoinRequest(int id, int participantId)
    {
        var result = await _service.ApproveJoinRequestAsync(id, participantId, User.GetUserId());
        return result is null ? NotFound(new { message = "Join request not found" }) : Ok(result);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpPost("{id:int}/join-requests/{participantId:int}/reject")]
    public async Task<IActionResult> RejectJoinRequest(int id, int participantId, [FromBody] JoinRequestDecisionDto dto)
    {
        var result = await _service.RejectJoinRequestAsync(id, participantId, User.GetUserId(), dto.DecisionNote);
        return result is null ? NotFound(new { message = "Join request not found" }) : Ok(result);
    }
}
