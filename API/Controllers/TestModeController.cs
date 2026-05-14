using API.DTOs.QuizGame;
using API.Entities.QuizGame;
using API.Extensions;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.QuizGame;

[ApiController]
[Route("api/test-mode")]
public class TestModeController : ControllerBase
{
    private readonly ITestModeService _service;
    private readonly IQuizService _quizService;
    private readonly IQuizAccessService _quizAccessService;

    public TestModeController(ITestModeService service, IQuizService quizService, IQuizAccessService quizAccessService)
    {
        _service = service;
        _quizService = quizService;
        _quizAccessService = quizAccessService;
    }

    [AllowAnonymous]
    [HttpGet("quizzes")]
    public async Task<IActionResult> Quizzes([FromQuery] QuizQueryDto query)
    {
        query.Mode = QuizMode.Test;
        query.ExamMode = ExamMode.Test;
        query.IsPublished = true;
        query.PageNumber = query.PageNumber <= 0 ? 1 : query.PageNumber;
        query.PageSize = query.PageSize <= 0 ? 200 : query.PageSize;

        return Ok(await _quizService.GetAllAsync(query));
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpPost("quizzes/{quizId:int}/start")]
    public async Task<IActionResult> Start(int quizId, [FromBody] StartTestAttemptDto dto)
    {
        var userId = User.GetUserId();
        
        var checkResult = await _quizAccessService.CheckAttemptAsync(quizId, userId);
        
        if (!checkResult.CanStart)
        {
            return BadRequest(new { message = checkResult.BlockReason ?? "You cannot start this exam" });
        }

        var attempt = await _service.StartAsync(quizId, userId, dto);
        
        if (attempt is null)
        {
            return NotFound(new { message = "Quiz not found or not published for test mode" });
        }

        return Ok(attempt);
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpGet("attempts/{attemptId:int}/overview")]
    public async Task<IActionResult> Overview(int attemptId)
    {
        var overview = await _service.GetAttemptOverviewAsync(attemptId, User.GetUserId(), CanManageAttempts());
        return overview is null ? NotFound(new { message = "Attempt not found" }) : Ok(overview);
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpGet("attempts/{attemptId:int}/questions")]
    public async Task<IActionResult> Questions(int attemptId)
    {
        return Ok(await _service.GetQuestionsAsync(attemptId, User.GetUserId(), CanManageAttempts()));
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpGet("attempts/{attemptId:int}/current-question")]
    public async Task<IActionResult> CurrentQuestion(int attemptId, [FromQuery] int? questionIndex)
    {
        var question = await _service.GetCurrentQuestionAsync(attemptId, User.GetUserId(), questionIndex, CanManageAttempts());
        return question is null ? NotFound(new { message = "No active question" }) : Ok(question);
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpPost("attempts/{attemptId:int}/submit-answer")]
    public async Task<IActionResult> SubmitAnswer(int attemptId, [FromBody] SubmitTestAnswerDto dto)
    {
        var result = await _service.SubmitAnswerAsync(attemptId, User.GetUserId(), dto, CanManageAttempts());
        return result.Accepted
            ? Ok(result)
            : BadRequest(result);
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpPost("attempts/{attemptId:int}/finish")]
    public async Task<IActionResult> Finish(int attemptId, [FromBody] FinishTestAttemptDto? dto)
    {
        var result = await _service.FinishAsync(attemptId, User.GetUserId(), dto ?? new FinishTestAttemptDto(), CanManageAttempts());
        return result is null ? NotFound(new { message = "Attempt not found" }) : Ok(result);
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpGet("attempts/{attemptId:int}/result")]
    public async Task<IActionResult> Result(int attemptId)
    {
        var result = await _service.GetResultAsync(attemptId, User.GetUserId(), CanManageAttempts());
        return result is null ? NotFound(new { message = "Attempt not found" }) : Ok(result);
    }

    [Authorize(Roles = "Player,Admin,Host")]
    [HttpGet("history/me")]
    public async Task<IActionResult> MyHistory()
    {
        var userId = User.GetUserId();
        return Ok(await _service.GetMyHistoryAsync(userId));
    }

    private bool CanManageAttempts()
    {
        return User.IsInRole("Admin") || User.IsInRole("Host");
    }
}


