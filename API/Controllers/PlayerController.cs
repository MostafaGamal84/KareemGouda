using API.DTOs.QuizGame;
using API.Extensions;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.QuizGame;

[ApiController]
[Route("api/player")]
public class PlayerController : ControllerBase
{
    private readonly IPlayerService _playerService;
    private readonly IGameSessionService _gameSessionService;

    public PlayerController(IPlayerService playerService, IGameSessionService gameSessionService)
    {
        _playerService = playerService;
        _gameSessionService = gameSessionService;
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpGet("live-sessions")]
    public async Task<IActionResult> LiveSessionsBrowse()
    {
        var userId = User.Identity?.IsAuthenticated == true ? (int?)User.GetUserId() : null;
        return Ok(await _gameSessionService.GetLiveBrowseForStudentAsync(userId));
    }

    [AllowAnonymous]
    [HttpPost("join")]
    public async Task<IActionResult> Join([FromBody] PlayerJoinDto dto)
    {
        try
        {
            var result = await _playerService.JoinAsync(dto, User.Identity?.IsAuthenticated == true ? User.GetUserId() : null);
            return result is null ? NotFound(new { message = "Session not found" }) : Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [AllowAnonymous]
    [HttpGet("session/{sessionId:int}/waiting-room")]
    public async Task<IActionResult> WaitingRoom(int sessionId)
    {
        var result = await _playerService.GetWaitingRoomAsync(sessionId);
        return result is null ? NotFound(new { message = "Session not found" }) : Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("session/{sessionId:int}/current-question")]
    public async Task<IActionResult> CurrentQuestion(
        int sessionId,
        [FromQuery] int? questionIndex,
        [FromQuery] int? participantId,
        [FromQuery] string? token)
    {
        var question = await _playerService.GetCurrentQuestionAsync(
            sessionId,
            questionIndex,
            participantId,
            token);
        return question is null ? NotFound(new { message = "No active question" }) : Ok(question);
    }

    [AllowAnonymous]
    [HttpPost("session/{sessionId:int}/submit-answer")]
    public async Task<IActionResult> SubmitAnswer(int sessionId, [FromBody] SubmitPlayerAnswerDto dto)
    {
        var result = await _playerService.SubmitAnswerAsync(sessionId, dto);
        return result.Accepted
            ? Ok(result)
            : BadRequest(result);
    }

    [AllowAnonymous]
    [HttpGet("session/{sessionId:int}/leaderboard")]
    public async Task<IActionResult> Leaderboard(int sessionId)
    {
        return Ok(await _playerService.GetLeaderboardAsync(sessionId));
    }

    [AllowAnonymous]
    [HttpGet("session/{sessionId:int}/result/{participantId:int}")]
    public async Task<IActionResult> Result(int sessionId, int participantId)
    {
        var result = await _playerService.GetResultAsync(sessionId, participantId);
        return result is null ? NotFound(new { message = "Result not found" }) : Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("session/{sessionId:int}/participant/{participantId:int}/status")]
    public async Task<IActionResult> ParticipantStatus(int sessionId, int participantId, [FromQuery] string? token)
    {
        var result = await _playerService.GetParticipantStatusAsync(sessionId, participantId, token);
        return result is null ? NotFound(new { message = "Participant not found" }) : Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("session/{sessionId:int}/leave")]
    public async Task<IActionResult> Leave(int sessionId, [FromBody] LeaveSessionDto dto)
    {
        var ok = await _playerService.LeaveSessionAsync(sessionId, dto);
        return ok ? Ok(new { message = "Left session successfully" }) : BadRequest(new { message = "Unable to leave session" });
    }

    [AllowAnonymous]
    [HttpPost("session/{sessionId:int}/complete-test")]
    public async Task<IActionResult> CompleteTest(int sessionId, [FromBody] LeaveSessionDto dto)
    {
        var ok = await _playerService.CompleteTimedTestAsync(sessionId, dto);
        return ok
            ? Ok(new { message = "Test completed successfully" })
            : BadRequest(new { message = "Unable to complete test" });
    }
}
