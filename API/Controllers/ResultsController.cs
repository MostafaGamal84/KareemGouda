using API.Interfaces.QuizGame;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.QuizGame;

[ApiController]
[Route("api/results")]
public class ResultsController : ControllerBase
{
    private readonly IResultsService _service;

    public ResultsController(IResultsService service)
    {
        _service = service;
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("game-sessions/{sessionId:int}")]
    public async Task<IActionResult> Session(int sessionId)
    {
        var result = await _service.GetSessionResultAsync(sessionId);
        return result is null ? NotFound(new { message = "Session not found" }) : Ok(result);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("game-sessions/{sessionId:int}/participants")]
    public async Task<IActionResult> SessionParticipants(int sessionId)
    {
        return Ok(await _service.GetSessionParticipantsAsync(sessionId));
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("game-sessions/{sessionId:int}/questions-analysis")]
    public async Task<IActionResult> QuestionsAnalysis(int sessionId)
    {
        return Ok(await _service.GetSessionQuestionsAnalysisAsync(sessionId));
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpGet("test-mode/attempts/{attemptId:int}")]
    public async Task<IActionResult> TestAttempt(int attemptId)
    {
        var result = await _service.GetTestAttemptResultAsync(attemptId, User.GetUserId(), CanManageAttempts());
        return result is null ? NotFound(new { message = "Attempt not found" }) : Ok(result);
    }

    [Authorize(Roles = "Admin,Host")]
    [HttpGet("quizzes/{quizId:int}/summary")]
    public async Task<IActionResult> QuizSummary(int quizId)
    {
        var summary = await _service.GetQuizSummaryAsync(quizId);
        return summary is null ? NotFound(new { message = "Quiz not found" }) : Ok(summary);
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpGet("player/history")]
    public async Task<IActionResult> PlayerHistory()
    {
        var userId = User.GetUserId();
        return Ok(await _service.GetPlayerSessionHistoryAsync(userId));
    }

    private bool CanManageAttempts()
    {
        return User.IsInRole("Admin") || User.IsInRole("Host");
    }
}
