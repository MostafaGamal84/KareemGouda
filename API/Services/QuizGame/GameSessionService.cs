using API.Data;
using API.DTOs.QuizGame;
using API.Entities.QuizGame;
using API.Interfaces.QuizGame;
using API.SignalR;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace API.Services.QuizGame;

public class GameSessionService : IGameSessionService
{
    private readonly DataContext _context;
    private readonly IHubContext<LiveGameHub> _hubContext;
    private readonly IWebHostEnvironment _environment;
    private static readonly HashSet<string> AllowedCoverExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    public GameSessionService(DataContext context, IHubContext<LiveGameHub> hubContext, IWebHostEnvironment environment)
    {
        _context = context;
        _hubContext = hubContext;
        _environment = environment;
    }

    public async Task<GameSessionResponseDto> CreateAsync(CreateGameSessionDto dto, int? hostId, string baseUrl)
    {
        var quiz = await _context.Set<Quiz>()
            .Include(x => x.QuizCategories.Where(qc => !qc.IsDeleted))
            .ThenInclude(x => x.Category)
            .FirstOrDefaultAsync(x => x.Id == dto.QuizId && !x.IsDeleted);
        if (quiz is null)
        {
            throw new ArgumentException("Quiz not found.");
        }

        var scheduledStartAt = ToUtc(dto.ScheduledStartAt);
        var scheduledEndAt = ToUtc(dto.ScheduledEndAt);
        var durationMinutes = NormalizeDurationMinutes(dto.DurationMinutes ?? (quiz.DurationMinutes > 0 ? quiz.DurationMinutes : null));
        var flowMode = NormalizeFlowMode(dto.QuestionFlowMode);

        if (flowMode != SessionQuestionFlowMode.TimedByTest &&
            scheduledStartAt.HasValue &&
            durationMinutes.HasValue &&
            !scheduledEndAt.HasValue)
        {
            scheduledEndAt = scheduledStartAt.Value.AddMinutes(durationMinutes.Value);
        }

        if (scheduledStartAt.HasValue && scheduledEndAt.HasValue && scheduledEndAt <= scheduledStartAt)
        {
            throw new ArgumentException("Session end time must be after start time.");
        }

        if (!durationMinutes.HasValue && scheduledStartAt.HasValue && scheduledEndAt.HasValue)
        {
            durationMinutes = Math.Max(1, (int)Math.Ceiling((scheduledEndAt.Value - scheduledStartAt.Value).TotalMinutes));
        }

        var accessType = NormalizeAccessType(dto.AccessType);
        var resolvedAllowedUserIds = new List<int>();
        if (accessType == SessionAccessType.Private)
        {
            var requested = dto.AllowedUserIds?.Where(id => id > 0).Distinct().ToList() ?? new List<int>();
            if (requested.Count == 0)
            {
                throw new ArgumentException("Private sessions require at least one allowed student.");
            }

            resolvedAllowedUserIds = await _context.Users.AsNoTracking()
                .Where(u => requested.Contains(u.Id) && !u.IsDeleted)
                .Select(u => u.Id)
                .ToListAsync();

            if (resolvedAllowedUserIds.Count != requested.Count)
            {
                throw new ArgumentException("One or more selected students are invalid.");
            }
        }

        var joinCode = await GenerateUniqueJoinCodeAsync();
        var session = new GameSession
        {
            QuizId = dto.QuizId,
            HostId = hostId,
            JoinCode = joinCode,
            JoinLink = $"{baseUrl.TrimEnd('/')}/player/join/{joinCode}",
            Status = scheduledStartAt.HasValue ? GameSessionStatus.Draft : GameSessionStatus.Waiting,
            AccessType = accessType,
            QuestionFlowMode = flowMode,
            ScheduledStartAt = scheduledStartAt,
            ScheduledEndAt = scheduledEndAt,
            DurationMinutes = durationMinutes,
            CreatedAt = DateTime.UtcNow,
            CurrentQuestionIndex = 0,
            IsDeleted = false
        };

        foreach (var userId in resolvedAllowedUserIds)
        {
            session.AllowedUsers.Add(new GameSessionAllowedUser
            {
                UserId = userId,
                IsDeleted = false
            });
        }

        _context.Set<GameSession>().Add(session);
        await _context.SaveChangesAsync();

        await BroadcastSessionUpdatedAsync(session.Id);
        return await GetByIdAsync(session.Id) ?? throw new InvalidOperationException("Session was not created.");
    }

    public async Task<IEnumerable<GameSessionResponseDto>> GetAllAsync()
    {
        var sessions = await _context.Set<GameSession>()
            .AsNoTracking()
            .Include(x => x.Quiz)
            .ThenInclude(x => x.QuizCategories.Where(qc => !qc.IsDeleted))
            .ThenInclude(x => x.Category)
            .Include(x => x.Participants)
            .Include(x => x.AllowedUsers)
            .Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();

        return sessions.Select(MapSession);
    }

    public async Task<GameSessionResponseDto?> GetByIdAsync(int id)
    {
        var session = await LoadSession(id);
        return session is null ? null : MapSession(session);
    }

    public async Task<GameSessionResponseDto?> GetByCodeAsync(string joinCode)
    {
        var session = await _context.Set<GameSession>()
            .AsNoTracking()
            .Include(x => x.Quiz)
            .ThenInclude(x => x.QuizCategories.Where(qc => !qc.IsDeleted))
            .ThenInclude(x => x.Category)
            .Include(x => x.Participants)
            .Include(x => x.AllowedUsers)
            .FirstOrDefaultAsync(x => x.JoinCode == joinCode && !x.IsDeleted);

        return session is null ? null : MapSession(session);
    }

    public async Task<SessionStateDto?> StartAsync(int id)
    {
        var session = await LoadSession(id);
        if (session is null)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        session.Status = GameSessionStatus.Live;
        session.StartedAt = now;
        session.EndedAt = null;
        StartTimedTestParticipantWindows(session, now);
        await ConfigureTimerForCurrentQuestionAsync(session, now);

        await _context.SaveChangesAsync();

        var state = await GetStateAsync(id);
        await _hubContext.Clients.Group(GetGroupName(id)).SendAsync("sessionStarted", state);
        await BroadcastSessionUpdatedAsync(id);
        return state;
    }

    public async Task<SessionStateDto?> PauseAsync(int id)
    {
        var session = await LoadSession(id);
        if (session is null)
        {
            return null;
        }

        if (session.QuestionFlowMode == SessionQuestionFlowMode.TimedByQuestion &&
            session.CurrentQuestionEndsAt.HasValue)
        {
            var remaining = (int)Math.Ceiling((session.CurrentQuestionEndsAt.Value - DateTime.UtcNow).TotalSeconds);
            session.CurrentQuestionRemainingSeconds = remaining > 0 ? remaining : 1;
            session.CurrentQuestionEndsAt = null;
        }

        session.Status = GameSessionStatus.Paused;
        await _context.SaveChangesAsync();

        var state = await GetStateAsync(id);
        await _hubContext.Clients.Group(GetGroupName(id)).SendAsync("sessionPaused", state);
        await BroadcastSessionUpdatedAsync(id);
        return state;
    }

    public async Task<SessionStateDto?> ResumeAsync(int id)
    {
        var session = await LoadSession(id);
        if (session is null)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        session.Status = GameSessionStatus.Live;
        if (session.QuestionFlowMode == SessionQuestionFlowMode.TimedByQuestion)
        {
            var remaining = session.CurrentQuestionRemainingSeconds;
            await ConfigureTimerForCurrentQuestionAsync(session, now, remaining);
        }
        else
        {
            ClearQuestionTimer(session);
        }

        await _context.SaveChangesAsync();

        var state = await GetStateAsync(id);
        await _hubContext.Clients.Group(GetGroupName(id)).SendAsync("sessionResumed", state);
        await BroadcastSessionUpdatedAsync(id);
        return state;
    }

    public async Task<SessionStateDto?> EndAsync(int id)
    {
        var session = await LoadSession(id);
        if (session is null)
        {
            return null;
        }

        session.Status = GameSessionStatus.Ended;
        session.EndedAt = DateTime.UtcNow;
        ClearQuestionTimer(session);

        await RecalculateRanksAsync(id);
        await _context.SaveChangesAsync();

        var state = await GetStateAsync(id);
        await _hubContext.Clients.Group(GetGroupName(id)).SendAsync("sessionEnded", state);
        await BroadcastSessionUpdatedAsync(id);
        return state;
    }

    public async Task<SessionStateDto?> NextQuestionAsync(int id)
    {
        var session = await LoadSession(id);
        if (session is null)
        {
            return null;
        }

        if (session.QuestionFlowMode == SessionQuestionFlowMode.TimedByTest)
        {
            throw new ArgumentException("Timed-by-test sessions use student-controlled question navigation.");
        }

        var totalQuestions = await _context.Set<QuizQuestion>().CountAsync(x => x.QuizId == session.QuizId && !x.IsDeleted);
        if (totalQuestions == 0)
        {
            throw new ArgumentException("Session quiz has no questions.");
        }

        if (session.CurrentQuestionIndex < totalQuestions - 1)
        {
            session.CurrentQuestionIndex += 1;
            await ConfigureTimerForCurrentQuestionAsync(session, DateTime.UtcNow);
        }
        else
        {
            session.Status = GameSessionStatus.Ended;
            session.EndedAt = DateTime.UtcNow;
            ClearQuestionTimer(session);
        }

        await _context.SaveChangesAsync();

        var state = await GetStateAsync(id);
        await _hubContext.Clients.Group(GetGroupName(id)).SendAsync("nextQuestion", state);

        var leaderboard = await GetLeaderboardAsync(id);
        await _hubContext.Clients.Group(GetGroupName(id)).SendAsync("leaderboardUpdated", leaderboard);
        await BroadcastSessionUpdatedAsync(id);

        return state;
    }

    public async Task<List<LeaderboardItemDto>> GetLeaderboardAsync(int id)
    {
        await RecalculateRanksAsync(id);
        await _context.SaveChangesAsync();

        var participants = await _context.Set<GameParticipant>()
            .AsNoTracking()
            .Where(x => x.GameSessionId == id && !x.IsDeleted && x.JoinStatus == ParticipantJoinStatus.Approved)
            .OrderBy(x => x.Rank)
            .ThenByDescending(x => x.TotalScore)
            .ToListAsync();

        return participants.Select(x => new LeaderboardItemDto
        {
            ParticipantId = x.Id,
            DisplayName = x.DisplayName,
            TotalScore = x.TotalScore,
            Rank = x.Rank ?? 0
        }).ToList();
    }

    public async Task<SessionStateDto?> GetStateAsync(int id)
    {
        var session = await LoadSession(id);
        if (session is null)
        {
            return null;
        }

        var totalQuestions = await _context.Set<QuizQuestion>()
            .AsNoTracking()
            .CountAsync(x => x.QuizId == session.QuizId && !x.IsDeleted);
        var currentQuestion = await GetQuestionByIndexInternalAsync(session, session.CurrentQuestionIndex);
        var nextQuestion = await GetQuestionByIndexInternalAsync(session, session.CurrentQuestionIndex + 1);

        return new SessionStateDto
        {
            SessionId = session.Id,
            QuizId = session.QuizId,
            QuizTitle = session.Quiz.Title,
            QuizCoverImageUrl = GetCoverImageUrl(session.QuizId),
            Status = session.Status,
            AccessType = session.AccessType,
            QuestionFlowMode = session.QuestionFlowMode,
            ScheduledStartAt = ToUtc(session.ScheduledStartAt),
            ScheduledEndAt = ToUtc(session.ScheduledEndAt),
            DurationMinutes = session.DurationMinutes,
            CurrentQuestionIndex = session.CurrentQuestionIndex,
            TotalQuestions = totalQuestions,
            CurrentQuestion = currentQuestion,
            NextQuestion = nextQuestion,
            CurrentQuestionEndsAtUtc = ToUtc(session.CurrentQuestionEndsAt),
            CurrentQuestionDurationSeconds = currentQuestion?.AnswerSeconds,
            SessionEndsAtUtc = null,
            ParticipantsCount = session.Participants.Count(IsApprovedParticipant)
        };
    }

    public async Task<List<JoinRequestItemDto>> GetJoinRequestsAsync(int sessionId)
    {
        var sessionExists = await _context.Set<GameSession>()
            .AsNoTracking()
            .AnyAsync(x => x.Id == sessionId && !x.IsDeleted);
        if (!sessionExists)
        {
            return new List<JoinRequestItemDto>();
        }

        var items = await _context.Set<GameParticipant>()
            .AsNoTracking()
            .Where(x => x.GameSessionId == sessionId && !x.IsDeleted && x.JoinStatus == ParticipantJoinStatus.Pending)
            .OrderBy(x => x.RequestedAt)
            .ToListAsync();

        return items.Select(MapJoinRequest).ToList();
    }

    public async Task<JoinRequestItemDto?> ApproveJoinRequestAsync(int sessionId, int participantId, int? hostId)
    {
        var participant = await _context.Set<GameParticipant>()
            .FirstOrDefaultAsync(x =>
                x.Id == participantId &&
                x.GameSessionId == sessionId &&
                !x.IsDeleted &&
                x.JoinStatus == ParticipantJoinStatus.Pending);

        if (participant is null)
        {
            return null;
        }

        participant.JoinStatus = ParticipantJoinStatus.Approved;
        participant.IsConnected = true;
        participant.ApprovedAt = DateTime.UtcNow;
        participant.DecisionByHostId = hostId;
        participant.DecisionNote = null;
        participant.JoinedAt = DateTime.UtcNow;

        var session = await _context.Set<GameSession>()
            .FirstAsync(x => x.Id == sessionId && !x.IsDeleted);
        StartTimedTestParticipantWindow(participant, session, participant.JoinedAt);

        await _context.SaveChangesAsync();

        var item = MapJoinRequest(participant);
        await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("joinRequestApproved", item);
        await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("playerJoined", new
        {
            sessionId,
            participantId = participant.Id,
            displayName = participant.DisplayName
        });

        await BroadcastWaitingRoomUpdatedAsync(sessionId);
        var leaderboard = await GetLeaderboardAsync(sessionId);
        await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("leaderboardUpdated", leaderboard);
        await BroadcastSessionUpdatedAsync(sessionId);

        return item;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var session = await _context.Set<GameSession>()
            .Include(x => x.Participants)
            .Include(x => x.Answers)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (session is null)
        {
            return false;
        }

        session.IsDeleted = true;
        session.Status = GameSessionStatus.Ended;
        session.EndedAt ??= DateTime.UtcNow;
        ClearQuestionTimer(session);

        foreach (var participant in session.Participants.Where(x => !x.IsDeleted))
        {
            participant.IsDeleted = true;
            participant.IsConnected = false;
            participant.LeftAt ??= DateTime.UtcNow;
            participant.JoinStatus = participant.JoinStatus == ParticipantJoinStatus.Approved
                ? ParticipantJoinStatus.Left
                : participant.JoinStatus;
        }

        foreach (var answer in session.Answers.Where(x => !x.IsDeleted))
        {
            answer.IsDeleted = true;
        }

        await _context.SaveChangesAsync();

        var payload = new { id = session.Id, sessionId = session.Id };
        await _hubContext.Clients.Group(GetGroupName(id)).SendAsync("sessionDeleted", payload);
        await _hubContext.Clients.Group(GetGlobalGroupName()).SendAsync("sessionDeleted", payload);

        return true;
    }

    public async Task<JoinRequestItemDto?> RejectJoinRequestAsync(int sessionId, int participantId, int? hostId, string? note)
    {
        var participant = await _context.Set<GameParticipant>()
            .FirstOrDefaultAsync(x =>
                x.Id == participantId &&
                x.GameSessionId == sessionId &&
                !x.IsDeleted &&
                x.JoinStatus == ParticipantJoinStatus.Pending);

        if (participant is null)
        {
            return null;
        }

        participant.JoinStatus = ParticipantJoinStatus.Rejected;
        participant.IsConnected = false;
        participant.RejectedAt = DateTime.UtcNow;
        participant.DecisionByHostId = hostId;
        participant.DecisionNote = string.IsNullOrWhiteSpace(note) ? "Join request rejected by host" : note.Trim();

        await _context.SaveChangesAsync();

        var item = MapJoinRequest(participant);
        await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("joinRequestRejected", item);
        await BroadcastWaitingRoomUpdatedAsync(sessionId);
        await BroadcastSessionUpdatedAsync(sessionId);

        return item;
    }

    public async Task<List<StudentLiveSessionBrowseDto>> GetLiveBrowseForStudentAsync(int? userId)
    {
        var sessions = await _context.Set<GameSession>()
            .AsNoTracking()
            .Include(x => x.Quiz)
            .ThenInclude(q => q.QuizAccess)
            .Include(x => x.AllowedUsers)
            .Where(x => !x.IsDeleted && x.Status != GameSessionStatus.Ended)
            .Where(x =>
                x.Quiz.QuizAccess != null &&
                !x.Quiz.QuizAccess.IsDeleted &&
                x.Quiz.QuizAccess.ExamMode == ExamMode.Live)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();

        var list = new List<StudentLiveSessionBrowseDto>();
        foreach (var s in sessions)
        {
            var allowIds = s.AllowedUsers.Where(x => !x.IsDeleted).Select(x => x.UserId).ToHashSet();
            var hasAllowlist = allowIds.Count > 0;
            bool canJoin;
            string? hint;

            if (s.AccessType == SessionAccessType.Public)
            {
                canJoin = true;
                hint = "Use the join link or code. Public sessions require a valid email when joining.";
            }
            else if (hasAllowlist)
            {
                if (userId.HasValue && userId.Value > 0 && allowIds.Contains(userId.Value))
                {
                    canJoin = true;
                    hint = "You are on the allow list—join while signed in with this account.";
                }
                else
                {
                    canJoin = false;
                    hint = !userId.HasValue || userId.Value <= 0
                        ? "Sign in with an allowed student account to join this private session."
                        : "Your account is not on this session's allow list.";
                }
            }
            else
            {
                canJoin = false;
                hint = "This private session uses host approval. Join with the code; the host may need to approve you.";
            }

            list.Add(new StudentLiveSessionBrowseDto
            {
                SessionId = s.Id,
                QuizId = s.QuizId,
                QuizTitle = s.Quiz.Title,
                Status = s.Status,
                AccessType = s.AccessType,
                JoinCode = s.JoinCode,
                JoinLink = s.JoinLink,
                CanJoin = canJoin,
                JoinHint = hint
            });
        }

        return list;
    }

    public async Task AutoAdvanceTimedSessionsAsync(DateTime? nowUtc = null)
    {
        var now = nowUtc ?? DateTime.UtcNow;
        await AutoEndExpiredSessionsAsync(now);
        await AutoStartScheduledSessionsAsync(now);

        var expiredSessionIds = await _context.Set<GameSession>()
            .AsNoTracking()
            .Where(x =>
                !x.IsDeleted &&
                x.Status == GameSessionStatus.Live &&
                x.QuestionFlowMode == SessionQuestionFlowMode.TimedByQuestion &&
                x.CurrentQuestionEndsAt.HasValue &&
                x.CurrentQuestionEndsAt <= now)
            .Select(x => x.Id)
            .ToListAsync();

        foreach (var sessionId in expiredSessionIds)
        {
            var session = await LoadSession(sessionId);
            if (session is null ||
                session.IsDeleted ||
                session.Status != GameSessionStatus.Live ||
                session.QuestionFlowMode != SessionQuestionFlowMode.TimedByQuestion ||
                !session.CurrentQuestionEndsAt.HasValue ||
                session.CurrentQuestionEndsAt > now)
            {
                continue;
            }

            var totalQuestions = await _context.Set<QuizQuestion>()
                .CountAsync(x => x.QuizId == session.QuizId && !x.IsDeleted);

            var ended = false;
            if (totalQuestions == 0 || session.CurrentQuestionIndex >= totalQuestions - 1)
            {
                session.Status = GameSessionStatus.Ended;
                session.EndedAt = now;
                ClearQuestionTimer(session);
                ended = true;
            }
            else
            {
                session.CurrentQuestionIndex += 1;
                await ConfigureTimerForCurrentQuestionAsync(session, now);
            }

            await _context.SaveChangesAsync();

            var state = await GetStateAsync(sessionId);
            if (state is null)
            {
                continue;
            }

            if (ended)
            {
                await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("sessionEnded", state);
            }
            else
            {
                await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("nextQuestion", state);
            }

            var leaderboard = await GetLeaderboardAsync(sessionId);
            await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("leaderboardUpdated", leaderboard);
            await BroadcastSessionUpdatedAsync(sessionId);
        }
    }

    private async Task RecalculateRanksAsync(int sessionId)
    {
        var participants = await _context.Set<GameParticipant>()
            .Where(x => x.GameSessionId == sessionId && !x.IsDeleted && x.JoinStatus == ParticipantJoinStatus.Approved)
            .OrderByDescending(x => x.TotalScore)
            .ThenBy(x => x.JoinedAt)
            .ToListAsync();

        var rank = 1;
        foreach (var item in participants)
        {
            item.Rank = rank++;
        }
    }

    private async Task<QuestionResponseDto?> GetQuestionByIndexInternalAsync(GameSession session, int questionIndex)
    {
        if (questionIndex < 0)
        {
            return null;
        }

        var qq = await _context.Set<QuizQuestion>()
            .AsNoTracking()
            .Where(x => x.QuizId == session.QuizId && !x.IsDeleted)
            .OrderBy(x => x.Order)
            .Skip(questionIndex)
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

        return new QuestionResponseDto
        {
            Id = qq.Question.Id,
            Title = qq.Question.Title,
            Text = qq.Question.Text,
            Type = qq.Question.Type,
            SelectionMode = qq.Question.SelectionMode,
            Difficulty = qq.Question.Difficulty,
            ImageUrl = GetQuestionImageUrl(qq.Question.Id),
            Explanation = qq.Question.Explanation,
            Points = qq.PointsOverride ?? qq.Question.Points,
            AnswerSeconds = qq.AnswerSeconds,
            CreatedBy = qq.Question.CreatedBy,
            CreatedAt = qq.Question.CreatedAt,
            CategoryId = primaryCategoryId,
            CategoryName = primaryCategoryName,
            Categories = categories,
            Choices = qq.Question.Type == QuestionType.ShortAnswer
                ? new List<QuestionChoiceDto>()
                : qq.Question.Choices
                    .OrderBy(c => c.Order)
                    .Select(c =>
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
    }

    private async Task BroadcastSessionUpdatedAsync(int sessionId)
    {
        var session = await LoadSession(sessionId);
        if (session is null)
        {
            return;
        }

        var payload = MapSession(session);
        await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("sessionUpdated", payload);
        await _hubContext.Clients.Group(GetGlobalGroupName()).SendAsync("sessionsUpdated", payload);
    }

    private async Task BroadcastWaitingRoomUpdatedAsync(int sessionId)
    {
        var session = await _context.Set<GameSession>()
            .AsNoTracking()
            .Include(x => x.Quiz)
            .Include(x => x.Participants)
            .FirstOrDefaultAsync(x => x.Id == sessionId && !x.IsDeleted);

        if (session is null)
        {
            return;
        }

        var players = session.Participants
            .Where(IsApprovedParticipant)
            .OrderBy(x => x.JoinedAt)
            .Select(x => new WaitingRoomPlayerDto
            {
                DisplayName = x.DisplayName,
                Email = x.Email
            })
            .ToList();

        var payload = new WaitingRoomDto
        {
            SessionId = session.Id,
            SessionStatus = session.Status.ToString(),
            QuizTitle = session.Quiz.Title,
            ParticipantsCount = players.Count,
            Players = players
        };

        await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("waitingRoomUpdated", payload);
    }

    private async Task<GameSession?> LoadSession(int id)
    {
        return await _context.Set<GameSession>()
            .Include(x => x.Quiz)
            .ThenInclude(x => x.QuizCategories.Where(qc => !qc.IsDeleted))
            .ThenInclude(x => x.Category)
            .Include(x => x.Participants)
            .Include(x => x.AllowedUsers)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    }

    private async Task ConfigureTimerForCurrentQuestionAsync(GameSession session, DateTime nowUtc, int? overrideDurationSeconds = null)
    {
        if (session.QuestionFlowMode != SessionQuestionFlowMode.TimedByQuestion || session.Status != GameSessionStatus.Live)
        {
            ClearQuestionTimer(session);
            return;
        }

        var seconds = overrideDurationSeconds ?? await GetQuestionAnswerSecondsAsync(session.QuizId, session.CurrentQuestionIndex);
        if (seconds <= 0)
        {
            ClearQuestionTimer(session);
            return;
        }

        session.CurrentQuestionStartedAt = nowUtc;
        session.CurrentQuestionEndsAt = nowUtc.AddSeconds(seconds);
        session.CurrentQuestionRemainingSeconds = null;
    }

    private async Task<int> GetQuestionAnswerSecondsAsync(int quizId, int questionIndex)
    {
        var seconds = await _context.Set<QuizQuestion>()
            .AsNoTracking()
            .Where(x => x.QuizId == quizId && !x.IsDeleted)
            .OrderBy(x => x.Order)
            .Select(x => x.AnswerSeconds)
            .Skip(questionIndex)
            .Take(1)
            .FirstOrDefaultAsync();

        if (seconds == 0) return 0;
        if (seconds < 5) return 5;
        if (seconds > 300) return 300;
        return seconds;
    }

    private static void ClearQuestionTimer(GameSession session)
    {
        session.CurrentQuestionStartedAt = null;
        session.CurrentQuestionEndsAt = null;
        session.CurrentQuestionRemainingSeconds = null;
    }

    private static SessionQuestionFlowMode NormalizeFlowMode(SessionQuestionFlowMode mode)
    {
        return mode switch
        {
            SessionQuestionFlowMode.TimedByQuestion => SessionQuestionFlowMode.TimedByQuestion,
            SessionQuestionFlowMode.TimedByTest => SessionQuestionFlowMode.TimedByTest,
            _ => SessionQuestionFlowMode.HostControlled
        };
    }

    private static SessionAccessType NormalizeAccessType(SessionAccessType accessType)
    {
        return accessType == SessionAccessType.Public
            ? SessionAccessType.Public
            : SessionAccessType.Private;
    }

    private static int? NormalizeDurationMinutes(int? value)
    {
        if (!value.HasValue || value.Value <= 0)
        {
            return null;
        }

        if (value.Value > 1440)
        {
            return 1440;
        }

        return value.Value;
    }

    private static DateTime? ToUtc(DateTime? value)
    {
        if (!value.HasValue) return null;
        return DateTime.SpecifyKind(value.Value, DateTimeKind.Utc);
    }

    private async Task AutoStartScheduledSessionsAsync(DateTime now)
    {
        var scheduledSessionIds = await _context.Set<GameSession>()
            .AsNoTracking()
            .Where(x =>
                !x.IsDeleted &&
                x.Status == GameSessionStatus.Draft &&
                x.ScheduledStartAt.HasValue &&
                x.ScheduledStartAt <= now)
            .Select(x => x.Id)
            .ToListAsync();

        foreach (var sessionId in scheduledSessionIds)
        {
            var session = await LoadSession(sessionId);
            if (session is null || session.IsDeleted || session.Status != GameSessionStatus.Draft)
            {
                continue;
            }

            session.Status = GameSessionStatus.Live;
            session.StartedAt = now;
            session.EndedAt = null;
            StartTimedTestParticipantWindows(session, now);
            await ConfigureTimerForCurrentQuestionAsync(session, now);
            await _context.SaveChangesAsync();

            var state = await GetStateAsync(sessionId);
            await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("sessionStarted", state);
            await BroadcastSessionUpdatedAsync(sessionId);
        }
    }

    private static void StartTimedTestParticipantWindows(GameSession session, DateTime startedAtUtc)
    {
        if (session.QuestionFlowMode != SessionQuestionFlowMode.TimedByTest)
        {
            return;
        }

        foreach (var participant in session.Participants.Where(IsApprovedParticipant))
        {
            StartTimedTestParticipantWindow(participant, session, startedAtUtc);
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

    private async Task AutoEndExpiredSessionsAsync(DateTime now)
    {
        var expiredSessionIds = await _context.Set<GameSession>()
            .AsNoTracking()
            .Where(x =>
                !x.IsDeleted &&
                x.Status != GameSessionStatus.Ended &&
                x.ScheduledEndAt.HasValue &&
                x.ScheduledEndAt <= now)
            .Select(x => x.Id)
            .ToListAsync();

        foreach (var sessionId in expiredSessionIds)
        {
            var session = await LoadSession(sessionId);
            if (session is null || session.IsDeleted || session.Status == GameSessionStatus.Ended)
            {
                continue;
            }

            session.Status = GameSessionStatus.Ended;
            session.EndedAt = now;
            ClearQuestionTimer(session);

            await RecalculateRanksAsync(sessionId);
            await _context.SaveChangesAsync();

            var state = await GetStateAsync(sessionId);
            await _hubContext.Clients.Group(GetGroupName(sessionId)).SendAsync("sessionEnded", state);
            await BroadcastSessionUpdatedAsync(sessionId);
        }
    }

    private GameSessionResponseDto MapSession(GameSession session)
    {
        return new GameSessionResponseDto
        {
            Id = session.Id,
            QuizId = session.QuizId,
            QuizTitle = session.Quiz.Title,
            QuizCoverImageUrl = GetCoverImageUrl(session.QuizId),
            HostId = session.HostId,
            JoinCode = session.JoinCode,
            JoinLink = session.JoinLink,
            Status = session.Status,
            AccessType = session.AccessType,
            QuestionFlowMode = session.QuestionFlowMode,
            ScheduledStartAt = ToUtc(session.ScheduledStartAt),
            ScheduledEndAt = ToUtc(session.ScheduledEndAt),
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
    }

    private static JoinRequestItemDto MapJoinRequest(GameParticipant participant)
    {
        return new JoinRequestItemDto
        {
            ParticipantId = participant.Id,
            DisplayName = participant.DisplayName,
            Email = participant.Email,
            JoinStatus = participant.JoinStatus,
            RequestedAt = participant.RequestedAt,
            DecisionNote = participant.DecisionNote
        };
    }

    private static bool IsApprovedParticipant(GameParticipant participant)
    {
        return !participant.IsDeleted && participant.JoinStatus == ParticipantJoinStatus.Approved;
    }

    private async Task<string> GenerateUniqueJoinCodeAsync()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();

        while (true)
        {
            var code = new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray());
            var exists = await _context.Set<GameSession>().AnyAsync(x => x.JoinCode == code && !x.IsDeleted);
            if (!exists)
            {
                return code;
            }
        }
    }

    private static string GetGlobalGroupName() => "sessions";
    private static string GetGroupName(int sessionId) => $"session-{sessionId}";

    private string GetCoverImageUrl(int quizId)
    {
        var uploadsDirectory = GetUploadsDirectoryPath("quizzes");
        if (!Directory.Exists(uploadsDirectory))
        {
            return string.Empty;
        }

        var filePath = Directory
            .EnumerateFiles(uploadsDirectory, $"quiz-{quizId}.*", SearchOption.TopDirectoryOnly)
            .FirstOrDefault(path => AllowedCoverExtensions.Contains(Path.GetExtension(path)));

        if (string.IsNullOrWhiteSpace(filePath))
        {
            return string.Empty;
        }

        var fileName = Path.GetFileName(filePath);
        var relativePath = $"/uploads/quizzes/{fileName}";
        var version = new DateTimeOffset(File.GetLastWriteTimeUtc(filePath)).ToUnixTimeSeconds();
        return $"{relativePath}?v={version}";
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
            .FirstOrDefault(path => AllowedCoverExtensions.Contains(Path.GetExtension(path)));

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
            .FirstOrDefault(path => AllowedCoverExtensions.Contains(Path.GetExtension(path)));

        if (string.IsNullOrWhiteSpace(filePath))
        {
            return string.Empty;
        }

        var fileName = Path.GetFileName(filePath);
        var relativePath = $"/uploads/question-choices/{fileName}";
        var version = new DateTimeOffset(File.GetLastWriteTimeUtc(filePath)).ToUnixTimeSeconds();
        return $"{relativePath}?v={version}";
    }

    private string GetUploadsDirectoryPath(string folderName)
    {
        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        }

        return Path.Combine(webRoot, "uploads", folderName);
    }
}
