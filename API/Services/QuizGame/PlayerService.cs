using API.Data;
using API.DTOs.QuizGame;
using API.Entities.QuizGame;
using API.Interfaces.QuizGame;
using API.SignalR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace API.Services.QuizGame;

public class PlayerService : IPlayerService
{
    private readonly DataContext _context;
    private readonly IHubContext<LiveGameHub> _hubContext;

    public PlayerService(DataContext context, IHubContext<LiveGameHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    public async Task<PlayerJoinResponseDto?> JoinAsync(PlayerJoinDto dto, int? userId)
    {
        if (string.IsNullOrWhiteSpace(dto.DisplayName))
        {
            throw new ArgumentException("Display name is required.");
        }

        GameSession? session = null;
        if (dto.SessionId.HasValue)
        {
            session = await _context.Set<GameSession>()
                .Include(x => x.AllowedUsers)
                .FirstOrDefaultAsync(x => x.Id == dto.SessionId.Value && !x.IsDeleted);
        }
        else if (!string.IsNullOrWhiteSpace(dto.JoinCode))
        {
            session = await _context.Set<GameSession>()
                .Include(x => x.AllowedUsers)
                .FirstOrDefaultAsync(x => x.JoinCode == dto.JoinCode.Trim().ToUpper() && !x.IsDeleted);
        }

        if (session is null)
        {
            return null;
        }

        var allowlistIds = session.AllowedUsers
            .Where(x => !x.IsDeleted)
            .Select(x => x.UserId)
            .ToHashSet();
        var hasAllowlist = allowlistIds.Count > 0;

        string? participantEmail = null;
        var requiresApproval = false;

        if (session.AccessType == SessionAccessType.Public)
        {
            var email = (dto.Email ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@', StringComparison.Ordinal))
            {
                throw new ArgumentException("A valid email is required to join a public session.");
            }

            participantEmail = email;
        }
        else if (session.AccessType == SessionAccessType.Private)
        {
            if (!userId.HasValue || userId.Value <= 0)
            {
                throw new ArgumentException("You must be signed in to join a private session.");
            }

            if (hasAllowlist)
            {
                if (!allowlistIds.Contains(userId.Value))
                {
                    throw new ArgumentException("You are not on the allowed list for this session.");
                }
            }
            else
            {
                requiresApproval = true;
            }
        }
        var normalizedName = dto.DisplayName.Trim();
        var autoStartedTimedTest = false;
        var existingParticipant = await _context.Set<GameParticipant>()
            .FirstOrDefaultAsync(x =>
                x.GameSessionId == session.Id &&
                x.DisplayName.ToLower() == normalizedName.ToLower());

        GameParticipant participant;
        if (existingParticipant is not null)
        {
            var canRejoin = existingParticipant.IsDeleted
                || existingParticipant.JoinStatus == ParticipantJoinStatus.Left
                || existingParticipant.JoinStatus == ParticipantJoinStatus.Rejected;

            if (!canRejoin)
            {
                throw new ArgumentException("Display name is already used in this session.");
            }

            if (session.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest &&
                existingParticipant.TestEndsAt.HasValue &&
                existingParticipant.TestEndsAt.Value <= DateTime.UtcNow)
            {
                throw new ArgumentException("Your test time has ended.");
            }

            participant = existingParticipant;
            participant.IsDeleted = false;
            participant.UserId = userId;
            participant.Email = participantEmail ?? participant.Email;
            participant.JoinStatus = requiresApproval ? ParticipantJoinStatus.Pending : ParticipantJoinStatus.Approved;
            participant.RequestedAt = DateTime.UtcNow;
            participant.ApprovedAt = requiresApproval ? null : DateTime.UtcNow;
            participant.RejectedAt = null;
            participant.LeftAt = null;
            participant.DecisionByHostId = null;
            participant.DecisionNote = null;
            participant.IsConnected = !requiresApproval;
            participant.ParticipantToken = Guid.NewGuid().ToString("N");
            participant.Rank = null;
            participant.JoinedAt = !requiresApproval ? DateTime.UtcNow : participant.JoinedAt;
        }
        else
        {
            participant = new GameParticipant
            {
                GameSessionId = session.Id,
                DisplayName = normalizedName,
                Email = participantEmail,
                UserId = userId,
                JoinStatus = requiresApproval ? ParticipantJoinStatus.Pending : ParticipantJoinStatus.Approved,
                RequestedAt = DateTime.UtcNow,
                ApprovedAt = requiresApproval ? null : DateTime.UtcNow,
                JoinedAt = !requiresApproval ? DateTime.UtcNow : DateTime.UtcNow,
                IsConnected = !requiresApproval,
                IsDeleted = false,
                ParticipantToken = Guid.NewGuid().ToString("N")
            };

            _context.Set<GameParticipant>().Add(participant);
        }

        if (!requiresApproval &&
            session.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest &&
            session.Status == GameSessionStatus.Waiting)
        {
            var now = DateTime.UtcNow;
            session.Status = GameSessionStatus.Live;
            session.StartedAt = now;
            session.EndedAt = null;
            autoStartedTimedTest = true;
        }

        if (!requiresApproval &&
            session.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest &&
            session.Status == GameSessionStatus.Live)
        {
            StartTimedTestParticipantWindow(participant, session, DateTime.UtcNow);
        }

        await _context.SaveChangesAsync();

        if (autoStartedTimedTest)
        {
            await _hubContext.Clients.Group(GetGroupName(session.Id)).SendAsync("sessionStarted", new
            {
                sessionId = session.Id,
                status = GameSessionStatus.Live,
                questionFlowMode = SessionQuestionFlowMode.TimedByTest
            });
        }

        if (requiresApproval)
        {
            await _hubContext.Clients.Group(GetGroupName(session.Id)).SendAsync("joinRequestCreated", new
            {
                sessionId = session.Id,
                participantId = participant.Id,
                displayName = participant.DisplayName,
                email = participant.Email,
                requestedAt = participant.RequestedAt
            });
        }
        else
        {
            await _hubContext.Clients.Group(GetGroupName(session.Id)).SendAsync("playerJoined", new
            {
                sessionId = session.Id,
                participantId = participant.Id,
                displayName = participant.DisplayName
            });
        }

        var waitingRoom = await GetWaitingRoomAsync(session.Id);
        if (waitingRoom is not null)
        {
            await _hubContext.Clients.Group(GetGroupName(session.Id)).SendAsync("waitingRoomUpdated", waitingRoom);
        }

        await BroadcastSessionUpdatedAsync(session.Id);

        return new PlayerJoinResponseDto
        {
            ParticipantId = participant.Id,
            ParticipantToken = participant.ParticipantToken,
            SessionId = session.Id,
            DisplayName = participant.DisplayName,
            JoinStatus = participant.JoinStatus,
            RequiresApproval = requiresApproval,
            TestEndsAtUtc = participant.TestEndsAt
        };
    }

    public async Task<WaitingRoomDto?> GetWaitingRoomAsync(int sessionId)
    {
        var session = await _context.Set<GameSession>()
            .AsNoTracking()
            .Include(x => x.Quiz)
            .Include(x => x.Participants)
            .FirstOrDefaultAsync(x => x.Id == sessionId && !x.IsDeleted);

        if (session is null)
        {
            return null;
        }

        return new WaitingRoomDto
        {
            SessionId = sessionId,
            SessionStatus = session.Status.ToString(),
            QuizTitle = session.Quiz.Title,
            ParticipantsCount = session.Participants.Count(IsApprovedParticipant),
            Players = session.Participants
                .Where(IsApprovedParticipant)
                .OrderBy(x => x.JoinedAt)
                .Select(x => new WaitingRoomPlayerDto
                {
                    DisplayName = x.DisplayName,
                    Email = x.Email
                })
                .ToList()
        };
    }

    public async Task<QuestionResponseDto?> GetCurrentQuestionAsync(
        int sessionId,
        int? questionIndex = null,
        int? participantId = null,
        string? participantToken = null)
    {
        var session = await _context.Set<GameSession>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == sessionId && !x.IsDeleted);

        if (session is null)
        {
            return null;
        }

        var resolvedQuestionIndex = session.CurrentQuestionIndex;
        GameParticipant? participant = null;
        if (session.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest)
        {
            if (session.Status != GameSessionStatus.Live ||
                !questionIndex.HasValue ||
                questionIndex.Value < 0 ||
                !participantId.HasValue ||
                string.IsNullOrWhiteSpace(participantToken))
            {
                return null;
            }

            participant = await _context.Set<GameParticipant>()
                .AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.Id == participantId.Value &&
                    x.GameSessionId == sessionId &&
                    !x.IsDeleted &&
                    x.JoinStatus == ParticipantJoinStatus.Approved &&
                    x.ParticipantToken == participantToken);
            if (participant is null)
            {
                return null;
            }

            if (participant.TestEndsAt.HasValue && participant.TestEndsAt.Value <= DateTime.UtcNow)
            {
                return null;
            }

            if (participant.TestCompletedAt.HasValue)
            {
                return null;
            }

            resolvedQuestionIndex = questionIndex.Value;
        }

        var qq = await _context.Set<QuizQuestion>()
            .AsNoTracking()
            .Where(x => x.QuizId == session.QuizId && !x.IsDeleted)
            .OrderBy(x => x.Order)
            .Skip(resolvedQuestionIndex)
            .Take(1)
            .Include(x => x.Question)
            .ThenInclude(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.Question)
            .ThenInclude(x => x.QuestionCategoryAssignments)
            .ThenInclude(x => x.Category)
            .FirstOrDefaultAsync();

        if (qq is null)
        {
            return null;
        }

        var categories = qq.Question.QuestionCategoryAssignments
            .Where(link => !link.IsDeleted && !link.Category.IsDeleted)
            .OrderBy(link => link.Category.Name)
            .Select(link => new QuestionCategoryRefDto
            {
                Id = link.CategoryId,
                Name = link.Category.Name
            })
            .ToList();
        var primaryCategoryId = qq.Question.CategoryId.HasValue && qq.Question.CategoryId.Value > 0
            ? qq.Question.CategoryId
            : categories.FirstOrDefault()?.Id;
        var primaryCategoryName = categories.FirstOrDefault(category => category.Id == primaryCategoryId)?.Name
            ?? categories.FirstOrDefault()?.Name;

        var response = new QuestionResponseDto
        {
            Id = qq.Question.Id,
            Title = qq.Question.Title,
            Text = qq.Question.Text,
            Type = qq.Question.Type,
            SelectionMode = qq.Question.SelectionMode,
            Difficulty = qq.Question.Difficulty,
            ImageUrl = GetQuestionImageUrl(qq.Question.Id),
            Explanation = participant is not null &&
                await _context.Set<Quiz>().AnyAsync(x => x.Id == session.QuizId && x.ShowExplanationAfterEachAnswer) &&
                await _context.Set<PlayerAnswer>().AnyAsync(x => x.GameSessionId == sessionId &&
                    x.ParticipantId == participant.Id && x.QuestionId == qq.QuestionId && !x.IsDeleted)
                ? qq.Question.Explanation : null,
            Points = qq.PointsOverride ?? qq.Question.Points,
            AnswerSeconds = qq.AnswerSeconds,
            CreatedBy = qq.Question.CreatedBy,
            CreatedAt = qq.Question.CreatedAt,
            CategoryId = primaryCategoryId,
            CategoryName = primaryCategoryName,
            Categories = categories,
            Choices = qq.Question.Type == QuestionType.ShortAnswer
                ? new List<QuestionChoiceDto>()
                : qq.Question.Choices.OrderBy(c => c.Order).Select(c =>
                {
                    var choiceImageUrl = GetChoiceImageUrl(c.Id);
                    return new QuestionChoiceDto
                    {
                        Id = c.Id,
                        ChoiceText = c.ChoiceText,
                        ImageUrl = choiceImageUrl,
                        HasImage = !string.IsNullOrWhiteSpace(choiceImageUrl),
                        IsCorrect = false,
                        Order = c.Order
                    };
                }).ToList()
        };

        if (participant is not null)
        {
            response.PlayerTestStartedAtUtc = participant.TestStartedAt;
            response.PlayerTestEndsAtUtc = participant.TestEndsAt;
            response.PlayerTestDurationMinutes = session.DurationMinutes;
            var savedAnswer = await _context.Set<PlayerAnswer>()
                .AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.GameSessionId == sessionId &&
                    x.ParticipantId == participant.Id &&
                    x.QuestionId == qq.QuestionId &&
                    !x.IsDeleted);
            if (savedAnswer is not null)
            {
                response.SavedAnswer = new PlayerSavedAnswerDto
                {
                    QuestionId = savedAnswer.QuestionId,
                    SelectedChoiceId = savedAnswer.SelectedChoiceId,
                    SelectedChoiceIds = DeserializeSelectedChoiceIds(savedAnswer.SelectedChoiceIdsJson),
                    TextAnswer = savedAnswer.TextAnswer
                };
            }
        }

        return response;
    }

    public async Task<PlayerAnswerSubmitResponseDto> SubmitAnswerAsync(int sessionId, SubmitPlayerAnswerDto dto)
    {
        var session = await _context.Set<GameSession>()
            .FirstOrDefaultAsync(x => x.Id == sessionId && !x.IsDeleted);
        if (session is null || session.Status != GameSessionStatus.Live)
        {
            return Rejected("Session is not live.");
        }

        var participant = await _context.Set<GameParticipant>()
            .FirstOrDefaultAsync(x => x.Id == dto.ParticipantId && x.GameSessionId == sessionId && !x.IsDeleted);

        if (participant is null || participant.JoinStatus != ParticipantJoinStatus.Approved || !participant.IsConnected)
        {
            return Rejected("Participant is not allowed to answer.");
        }

        if (session.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest &&
            !string.Equals(participant.ParticipantToken, dto.ParticipantToken, StringComparison.Ordinal))
        {
            return Rejected("Participant token is invalid.");
        }

        if (session.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest &&
            participant.TestCompletedAt.HasValue)
        {
            return Rejected("Test has already been completed.");
        }

        if (session.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest &&
            participant.TestEndsAt.HasValue &&
            participant.TestEndsAt.Value <= DateTime.UtcNow)
        {
            return Rejected("Test time has ended.");
        }

        var quizQuestionQuery = _context.Set<QuizQuestion>()
            .AsNoTracking()
            .Where(x => x.QuizId == session.QuizId && !x.IsDeleted);
        var currentQuestion = session.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest
            ? await quizQuestionQuery.FirstOrDefaultAsync(x => x.QuestionId == dto.QuestionId)
            : await quizQuestionQuery
                .OrderBy(x => x.Order)
                .Skip(session.CurrentQuestionIndex)
                .Take(1)
                .FirstOrDefaultAsync();
        if (currentQuestion is null || currentQuestion.QuestionId != dto.QuestionId)
        {
            return Rejected("Question mismatch.");
        }

        if (session.QuestionFlowMode == SessionQuestionFlowMode.TimedByQuestion &&
            session.CurrentQuestionEndsAt.HasValue &&
            session.CurrentQuestionEndsAt.Value < DateTime.UtcNow)
        {
            return Rejected("Question time has ended.");
        }

        var existingAnswer = await _context.Set<PlayerAnswer>().FirstOrDefaultAsync(x =>
            x.GameSessionId == sessionId &&
            x.ParticipantId == dto.ParticipantId &&
            x.QuestionId == dto.QuestionId &&
            !x.IsDeleted);

        if (existingAnswer is not null && session.QuestionFlowMode != SessionQuestionFlowMode.TimedByTest)
        {
            return Rejected("Answer already submitted.");
        }

        var question = await _context.Set<Question>()
            .Include(x => x.Choices.Where(c => !c.IsDeleted))
            .FirstOrDefaultAsync(x => x.Id == dto.QuestionId && !x.IsDeleted);

        if (question is null)
        {
            return Rejected("Question not found.");
        }

        var validationMessage = ValidateSubmission(question, dto);
        if (!string.IsNullOrWhiteSpace(validationMessage))
        {
            return Rejected(validationMessage);
        }

        var normalizedChoiceIds = NormalizeSelectedChoiceIds(question, dto.SelectedChoiceId, dto.SelectedChoiceIds);
        var isCorrect = EvaluateAnswer(question, dto);
        var score = isCorrect ? (currentQuestion.PointsOverride ?? question.Points) : 0;
        var correctChoiceIds = question.Type == QuestionType.ShortAnswer
            ? new List<int>()
            : question.Choices
                .Where(x => x.IsCorrect)
                .OrderBy(x => x.Order)
                .Select(x => x.Id)
                .ToList();
        var correctChoiceId = correctChoiceIds.Count == 1 ? correctChoiceIds[0] : (int?)null;

        var answer = existingAnswer ?? new PlayerAnswer
        {
            GameSessionId = sessionId,
            ParticipantId = dto.ParticipantId,
            QuestionId = dto.QuestionId,
            IsDeleted = false
        };
        var previousScore = existingAnswer?.ScoreAwarded ?? 0;
        answer.SelectedChoiceId = normalizedChoiceIds.Count == 1 ? normalizedChoiceIds[0] : null;
        answer.SelectedChoiceIdsJson = SerializeSelectedChoiceIds(normalizedChoiceIds);
        answer.TextAnswer = question.Type == QuestionType.ShortAnswer ? dto.TextAnswer?.Trim() : null;
        answer.IsCorrect = isCorrect;
        answer.ScoreAwarded = score;
        answer.ResponseTimeMs = dto.ResponseTimeMs;
        answer.AnsweredAt = DateTime.UtcNow;

        if (existingAnswer is null)
        {
            _context.Set<PlayerAnswer>().Add(answer);
        }

        participant.TotalScore += score - previousScore;

        await _context.SaveChangesAsync();

        var resultsDeferred = session.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest;
        await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("answerSubmitted", new
        {
            sessionId,
            participantId = participant.Id,
            questionId = question.Id,
            isCorrect = resultsDeferred ? (bool?)null : isCorrect,
            resultsDeferred
        });

        if (!resultsDeferred)
        {
            var leaderboard = await GetLeaderboardAsync(sessionId);
            await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("leaderboardUpdated", leaderboard);
        }

        return new PlayerAnswerSubmitResponseDto
        {
            Accepted = true,
            IsCorrect = !resultsDeferred && isCorrect,
            SelectedChoiceId = normalizedChoiceIds.Count == 1 ? normalizedChoiceIds[0] : null,
            SelectedChoiceIds = normalizedChoiceIds,
            CorrectChoiceId = resultsDeferred ? null : correctChoiceId,
            CorrectChoiceIds = resultsDeferred ? new List<int>() : correctChoiceIds,
            ResultsDeferred = resultsDeferred,
            Explanation = await _context.Set<Quiz>().AnyAsync(x => x.Id == session.QuizId && x.ShowExplanationAfterEachAnswer) ? question.Explanation : null,
            Message = resultsDeferred ? "Answer saved" : "Answer submitted"
        };
    }

    public async Task<List<LeaderboardItemDto>> GetLeaderboardAsync(int sessionId)
    {
        var deferResults = await _context.Set<GameSession>()
            .AsNoTracking()
            .Where(x => x.Id == sessionId && !x.IsDeleted)
            .Select(x =>
                x.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest &&
                x.Status != GameSessionStatus.Ended)
            .FirstOrDefaultAsync();

        var participants = await _context.Set<GameParticipant>()
            .Where(x => x.GameSessionId == sessionId && !x.IsDeleted && x.JoinStatus == ParticipantJoinStatus.Approved)
            .OrderByDescending(x => deferResults ? 0 : x.TotalScore)
            .ThenBy(x => x.JoinedAt)
            .ToListAsync();

        if (deferResults)
        {
            return participants.Select(x => new LeaderboardItemDto
            {
                ParticipantId = x.Id,
                DisplayName = x.DisplayName,
                TotalScore = 0,
                Rank = 0
            }).ToList();
        }

        var rank = 1;
        foreach (var p in participants)
        {
            p.Rank = rank++;
        }

        await _context.SaveChangesAsync();

        return participants.Select(x => new LeaderboardItemDto
        {
            ParticipantId = x.Id,
            DisplayName = x.DisplayName,
            TotalScore = x.TotalScore,
            Rank = x.Rank ?? 0
        }).ToList();
    }

    public async Task<ParticipantJoinStatusDto?> GetParticipantStatusAsync(int sessionId, int participantId, string? participantToken)
    {
        var participant = await _context.Set<GameParticipant>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.GameSessionId == sessionId && x.Id == participantId && !x.IsDeleted);

        if (participant is null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(participantToken) &&
            !string.Equals(participant.ParticipantToken, participantToken, StringComparison.Ordinal))
        {
            return null;
        }

        return new ParticipantJoinStatusDto
        {
            ParticipantId = participant.Id,
            SessionId = sessionId,
            DisplayName = participant.DisplayName,
            Email = participant.Email,
            JoinStatus = participant.JoinStatus,
            DecisionNote = participant.DecisionNote
        };
    }

    public async Task<bool> CompleteTimedTestAsync(int sessionId, LeaveSessionDto dto)
    {
        var session = await _context.Set<GameSession>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == sessionId && !x.IsDeleted);
        if (session is null || session.QuestionFlowMode != SessionQuestionFlowMode.TimedByTest)
        {
            return false;
        }

        var participant = await _context.Set<GameParticipant>()
            .FirstOrDefaultAsync(x =>
                x.Id == dto.ParticipantId &&
                x.GameSessionId == sessionId &&
                !x.IsDeleted &&
                x.JoinStatus == ParticipantJoinStatus.Approved &&
                x.ParticipantToken == dto.ParticipantToken);
        if (participant is null)
        {
            return false;
        }

        participant.TestCompletedAt ??= DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> LeaveSessionAsync(int sessionId, LeaveSessionDto dto)
    {
        if (dto.ParticipantId <= 0 || string.IsNullOrWhiteSpace(dto.ParticipantToken))
        {
            return false;
        }

        var participant = await _context.Set<GameParticipant>()
            .FirstOrDefaultAsync(x =>
                x.GameSessionId == sessionId &&
                x.Id == dto.ParticipantId &&
                !x.IsDeleted &&
                x.ParticipantToken == dto.ParticipantToken);

        if (participant is null)
        {
            return false;
        }

        participant.IsConnected = false;
        participant.JoinStatus = ParticipantJoinStatus.Left;
        participant.LeftAt = DateTime.UtcNow;
        participant.DecisionNote = "Player left the session";

        await _context.SaveChangesAsync();

        await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("participantLeft", new
        {
            sessionId,
            participantId = participant.Id,
            displayName = participant.DisplayName
        });

        var waitingRoom = await GetWaitingRoomAsync(sessionId);
        if (waitingRoom is not null)
        {
            await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("waitingRoomUpdated", waitingRoom);
        }

        var leaderboard = await GetLeaderboardAsync(sessionId);
        await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("leaderboardUpdated", leaderboard);

        await BroadcastSessionUpdatedAsync(sessionId);
        return true;
    }

    public async Task<ParticipantResultDto?> GetResultAsync(int sessionId, int participantId)
    {
        var participant = await _context.Set<GameParticipant>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.GameSessionId == sessionId && x.Id == participantId && !x.IsDeleted);

        if (participant is null)
        {
            return null;
        }

        var session = await _context.Set<GameSession>().AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == sessionId && !x.IsDeleted);
        if (session is null || (session.Status != GameSessionStatus.Ended &&
            !participant.TestCompletedAt.HasValue &&
            !(participant.TestEndsAt.HasValue && participant.TestEndsAt.Value <= DateTime.UtcNow)))
        {
            return null;
        }

        var questions = await _context.Set<QuizQuestion>().AsNoTracking()
            .Where(x => x.QuizId == session.QuizId && !x.IsDeleted && !x.Question.IsDeleted)
            .OrderBy(x => x.Order).Include(x => x.Question).ToListAsync();

        var answers = await _context.Set<PlayerAnswer>()
            .AsNoTracking()
            .Where(x => x.GameSessionId == sessionId && x.ParticipantId == participantId && !x.IsDeleted)
            .ToListAsync();

        return new ParticipantResultDto
        {
            ReviewQuestions = questions.Select((item, index) => new TestResultReviewItemDto
            {
                QuestionIndex = index,
                QuestionId = item.QuestionId,
                QuestionTitle = item.Question.Title,
                QuestionText = item.Question.Text,
                Explanation = item.Question.Explanation,
                IsAnswered = answers.Any(x => x.QuestionId == item.QuestionId),
                IsCorrect = answers.Any(x => x.QuestionId == item.QuestionId && x.IsCorrect)
            }).ToList(),
            ParticipantId = participant.Id,
            DisplayName = participant.DisplayName,
            TotalScore = participant.TotalScore,
            CorrectAnswers = answers.Count(x => x.IsCorrect),
            WrongAnswers = answers.Count(x => !x.IsCorrect),
            AverageResponseTimeMs = answers.Count == 0 ? 0 : answers.Average(x => x.ResponseTimeMs ?? 0)
        };
    }

    private static bool EvaluateAnswer(Question question, SubmitPlayerAnswerDto dto)
    {
        if (question.Type == QuestionType.ShortAnswer)
        {
            var expected = question.Choices.FirstOrDefault(x => x.IsCorrect)?.ChoiceText;
            return !string.IsNullOrWhiteSpace(expected)
                && !string.IsNullOrWhiteSpace(dto.TextAnswer)
                && string.Equals(expected.Trim(), dto.TextAnswer.Trim(), StringComparison.OrdinalIgnoreCase);
        }

        var selectedChoiceIds = NormalizeSelectedChoiceIds(question, dto.SelectedChoiceId, dto.SelectedChoiceIds);
        if (selectedChoiceIds.Count == 0)
        {
            return false;
        }

        if (question.SelectionMode == QuestionSelectionMode.Multiple && question.Type == QuestionType.MultipleChoice)
        {
            var correctChoiceIds = question.Choices
                .Where(x => x.IsCorrect)
                .Select(x => x.Id)
                .OrderBy(x => x)
                .ToList();

            return correctChoiceIds.SequenceEqual(selectedChoiceIds.OrderBy(x => x));
        }

        var choice = question.Choices.FirstOrDefault(x => x.Id == selectedChoiceIds[0]);
        return choice?.IsCorrect == true;
    }

    private async Task BroadcastSessionUpdatedAsync(int sessionId)
    {
        var session = await _context.Set<GameSession>()
            .AsNoTracking()
            .Include(x => x.Quiz)
            .ThenInclude(x => x.QuizCategories.Where(qc => !qc.IsDeleted))
            .ThenInclude(x => x.Category)
            .Include(x => x.Participants)
            .Include(x => x.AllowedUsers)
            .FirstOrDefaultAsync(x => x.Id == sessionId && !x.IsDeleted);

        if (session is null)
        {
            return;
        }

        var payload = new GameSessionResponseDto
        {
            Id = session.Id,
            QuizId = session.QuizId,
            QuizTitle = session.Quiz.Title,
            HostId = session.HostId,
            JoinCode = session.JoinCode,
            JoinLink = session.JoinLink,
            Status = session.Status,
            AccessType = session.AccessType,
            QuestionFlowMode = session.QuestionFlowMode,
            ScheduledStartAt = session.ScheduledStartAt,
            ScheduledEndAt = session.ScheduledEndAt,
            DurationMinutes = session.DurationMinutes,
            CurrentQuestionIndex = session.CurrentQuestionIndex,
            StartedAt = session.StartedAt,
            EndedAt = session.EndedAt,
            CreatedAt = session.CreatedAt,
            ParticipantsCount = session.Participants.Count(IsApprovedParticipant),
            Categories = session.Quiz.QuizCategories
                .Where(x => !x.IsDeleted && !x.Category.IsDeleted)
                .OrderBy(x => x.Category.Name)
                .Select(x => new QuizCategoryDto
                {
                    Id = x.CategoryId,
                    Name = x.Category.Name
                })
                .ToList(),
            AllowedUserIds = session.AllowedUsers
                .Where(x => !x.IsDeleted)
                .Select(x => x.UserId)
                .Distinct()
                .ToList()
        };

        await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("sessionUpdated", payload);
        await _hubContext.Clients.Group(GetGlobalGroupName()).SendAsync("sessionsUpdated", payload);
    }

    private static bool IsApprovedParticipant(GameParticipant participant)
    {
        return !participant.IsDeleted && participant.JoinStatus == ParticipantJoinStatus.Approved;
    }

    private static PlayerAnswerSubmitResponseDto Rejected(string message)
    {
        return new PlayerAnswerSubmitResponseDto
        {
            Accepted = false,
            IsCorrect = false,
            SelectedChoiceId = null,
            SelectedChoiceIds = new List<int>(),
            CorrectChoiceId = null,
            CorrectChoiceIds = new List<int>(),
            Message = message
        };
    }

    private static string? ValidateSubmission(Question question, SubmitPlayerAnswerDto dto)
    {
        if (question.Type == QuestionType.ShortAnswer)
        {
            return string.IsNullOrWhiteSpace(dto.TextAnswer) ? "Please write your answer first." : null;
        }

        var selectedChoiceIds = NormalizeSelectedChoiceIds(question, dto.SelectedChoiceId, dto.SelectedChoiceIds);
        if (selectedChoiceIds.Count == 0)
        {
            return question.SelectionMode == QuestionSelectionMode.Multiple
                ? "Please select at least one answer first."
                : "Please select an answer first.";
        }

        var validChoiceIds = question.Choices.Select(x => x.Id).ToHashSet();
        return selectedChoiceIds.All(validChoiceIds.Contains)
            ? null
            : "Selected answer is invalid for this question.";
    }

    private static List<int> NormalizeSelectedChoiceIds(Question question, int? selectedChoiceId, List<int>? selectedChoiceIds)
    {
        if (question.Type == QuestionType.ShortAnswer)
        {
            return new List<int>();
        }

        var values = (selectedChoiceIds ?? new List<int>())
            .Where(x => x > 0)
            .Distinct()
            .ToList();

        if (selectedChoiceId.HasValue && selectedChoiceId.Value > 0 && !values.Contains(selectedChoiceId.Value))
        {
            values.Insert(0, selectedChoiceId.Value);
        }

        if (question.SelectionMode != QuestionSelectionMode.Multiple || question.Type != QuestionType.MultipleChoice)
        {
            var single = values.FirstOrDefault();
            return single > 0 ? new List<int> { single } : new List<int>();
        }

        return values;
    }

    private static string? SerializeSelectedChoiceIds(List<int> selectedChoiceIds)
    {
        return selectedChoiceIds.Count == 0 ? null : JsonSerializer.Serialize(selectedChoiceIds);
    }

    private static List<int> DeserializeSelectedChoiceIds(string? selectedChoiceIdsJson)
    {
        if (string.IsNullOrWhiteSpace(selectedChoiceIdsJson))
        {
            return new List<int>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<int>>(selectedChoiceIdsJson)?
                .Where(id => id > 0)
                .Distinct()
                .ToList() ?? new List<int>();
        }
        catch (JsonException)
        {
            return new List<int>();
        }
    }

    private static void StartTimedTestParticipantWindow(
        GameParticipant participant,
        GameSession session,
        DateTime startedAtUtc)
    {
        if (session.QuestionFlowMode != SessionQuestionFlowMode.TimedByTest ||
            participant.TestStartedAt.HasValue)
        {
            return;
        }

        participant.TestStartedAt = startedAtUtc;
        if (session.DurationMinutes.HasValue && session.DurationMinutes.Value > 0)
        {
            var participantEnd = startedAtUtc.AddMinutes(session.DurationMinutes.Value);
            participant.TestEndsAt = session.ScheduledEndAt.HasValue && session.ScheduledEndAt.Value < participantEnd
                ? session.ScheduledEndAt
                : participantEnd;
        }
        else
        {
            participant.TestEndsAt = session.ScheduledEndAt;
        }
    }

    private string GetQuestionImageUrl(int questionId)
    {
        var uploadsDirectory = GetUploadsDirectoryPath("questions");
        if (!Directory.Exists(uploadsDirectory))
        {
            return string.Empty;
        }

        var filePath = Directory
            .EnumerateFiles(uploadsDirectory, $"question-{questionId}.*", SearchOption.TopDirectoryOnly)
            .FirstOrDefault();

        if (string.IsNullOrWhiteSpace(filePath))
        {
            return string.Empty;
        }

        var fileName = Path.GetFileName(filePath);
        var relativePath = $"/uploads/questions/{fileName}";
        var version = new DateTimeOffset(File.GetLastWriteTimeUtc(filePath)).ToUnixTimeSeconds();
        return $"{relativePath}?v={version}";
    }

    private string GetChoiceImageUrl(int choiceId)
    {
        var uploadsDirectory = GetUploadsDirectoryPath("question-choices");
        if (!Directory.Exists(uploadsDirectory))
        {
            return string.Empty;
        }

        var filePath = Directory
            .EnumerateFiles(uploadsDirectory, $"choice-{choiceId}.*", SearchOption.TopDirectoryOnly)
            .FirstOrDefault();

        if (string.IsNullOrWhiteSpace(filePath))
        {
            return string.Empty;
        }

        var fileName = Path.GetFileName(filePath);
        var relativePath = $"/uploads/question-choices/{fileName}";
        var version = new DateTimeOffset(File.GetLastWriteTimeUtc(filePath)).ToUnixTimeSeconds();
        return $"{relativePath}?v={version}";
    }

    private static string GetUploadsDirectoryPath(string folderName)
    {
        return Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", folderName);
    }

    private static string GetGlobalGroupName() => "sessions";
    private static string GetGroupName(int sessionId) => $"session-{sessionId}";
}
