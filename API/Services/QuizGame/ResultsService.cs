using API.Data;
using API.DTOs.QuizGame;
using API.Entities.QuizGame;
using API.Interfaces.QuizGame;
using Microsoft.EntityFrameworkCore;

namespace API.Services.QuizGame;

public class ResultsService : IResultsService
{
    private readonly DataContext _context;

    public ResultsService(DataContext context)
    {
        _context = context;
    }

    public async Task<GameSessionResponseDto?> GetSessionResultAsync(int sessionId)
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

        return new GameSessionResponseDto
        {
            Id = session.Id,
            QuizId = session.QuizId,
            QuizTitle = session.Quiz.Title,
            HostId = session.HostId,
            JoinCode = session.JoinCode,
            JoinLink = session.JoinLink,
            Status = session.Status,
            CurrentQuestionIndex = session.CurrentQuestionIndex,
            StartedAt = session.StartedAt,
            EndedAt = session.EndedAt,
            CreatedAt = session.CreatedAt,
            ParticipantsCount = session.Participants.Count(x => !x.IsDeleted)
        };
    }

    public async Task<IEnumerable<ParticipantResultDto>> GetSessionParticipantsAsync(int sessionId)
    {
        var participants = await _context.Set<GameParticipant>()
            .AsNoTracking()
            .Where(x => x.GameSessionId == sessionId && !x.IsDeleted)
            .OrderByDescending(x => x.TotalScore)
            .ToListAsync();

        var answers = await _context.Set<PlayerAnswer>()
            .AsNoTracking()
            .Where(x => x.GameSessionId == sessionId && !x.IsDeleted)
            .ToListAsync();

        return participants.Select(p =>
        {
            var participantAnswers = answers.Where(x => x.ParticipantId == p.Id).ToList();
            return new ParticipantResultDto
            {
                ParticipantId = p.Id,
                DisplayName = p.DisplayName,
                TotalScore = p.TotalScore,
                CorrectAnswers = participantAnswers.Count(x => x.IsCorrect),
                WrongAnswers = participantAnswers.Count(x => !x.IsCorrect),
                AverageResponseTimeMs = participantAnswers.Count == 0 ? 0 : participantAnswers.Average(x => x.ResponseTimeMs ?? 0)
            };
        }).ToList();
    }

    public async Task<IEnumerable<SessionQuestionAnalysisDto>> GetSessionQuestionsAnalysisAsync(int sessionId)
    {
        var answers = await _context.Set<PlayerAnswer>()
            .AsNoTracking()
            .Include(x => x.Question)
            .Where(x => x.GameSessionId == sessionId && !x.IsDeleted)
            .ToListAsync();

        return answers
            .GroupBy(x => new { x.QuestionId, x.Question.Title })
            .Select(g => new SessionQuestionAnalysisDto
            {
                QuestionId = g.Key.QuestionId,
                QuestionTitle = g.Key.Title,
                CorrectCount = g.Count(x => x.IsCorrect),
                WrongCount = g.Count(x => !x.IsCorrect),
                AverageResponseTimeMs = g.Average(x => x.ResponseTimeMs ?? 0)
            })
            .OrderBy(x => x.QuestionId)
            .ToList();
    }

    public async Task<TestResultDto?> GetTestAttemptResultAsync(int attemptId, int userId, bool canAccessAll)
    {
        var attempt = await _context.Set<QuizAttempt>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.Id == attemptId &&
                !x.IsDeleted &&
                (canAccessAll || x.UserId == userId));

        if (attempt is null)
        {
            return null;
        }

        var answers = await _context.Set<QuizAttemptAnswer>()
            .AsNoTracking()
            .Where(x => x.QuizAttemptId == attemptId && !x.IsDeleted)
            .ToListAsync();

        return new TestResultDto
        {
            AttemptId = attempt.Id,
            QuizId = attempt.QuizId,
            TotalScore = attempt.TotalScore,
            CorrectAnswers = answers.Count(x => x.IsCorrect),
            WrongAnswers = answers.Count(x => !x.IsCorrect),
            StartedAt = attempt.StartedAt,
            EndedAt = attempt.EndedAt
        };
    }

    public async Task<QuizSummaryDto?> GetQuizSummaryAsync(int quizId)
    {
        var quiz = await _context.Set<Quiz>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == quizId && !x.IsDeleted);
        if (quiz is null)
        {
            return null;
        }

        var sessions = await _context.Set<GameSession>()
            .AsNoTracking()
            .Where(x => x.QuizId == quizId && !x.IsDeleted)
            .ToListAsync();

        var sessionIds = sessions.Select(x => x.Id).ToList();

        var participants = await _context.Set<GameParticipant>()
            .AsNoTracking()
            .Where(x => sessionIds.Contains(x.GameSessionId) && !x.IsDeleted)
            .ToListAsync();

        var topPlayers = participants
            .OrderByDescending(x => x.TotalScore)
            .Take(10)
            .Select((x, idx) => new LeaderboardItemDto
            {
                ParticipantId = x.Id,
                DisplayName = x.DisplayName,
                TotalScore = x.TotalScore,
                Rank = idx + 1
            })
            .ToList();

        return new QuizSummaryDto
        {
            QuizId = quizId,
            QuizTitle = quiz.Title,
            TotalSessions = sessions.Count,
            TotalParticipants = participants.Count,
            AverageScore = participants.Count == 0 ? 0 : participants.Average(x => x.TotalScore),
            TopPlayers = topPlayers
        };
    }

    public async Task<IEnumerable<PlayerSessionHistoryItemDto>> GetPlayerSessionHistoryAsync(int userId)
    {
        var myParticipants = await _context.Set<GameParticipant>()
            .AsNoTracking()
            .Include(x => x.GameSession)
            .ThenInclude(x => x.Quiz)
            .Where(x =>
                x.UserId == userId &&
                !x.IsDeleted &&
                (x.JoinStatus == ParticipantJoinStatus.Approved || x.JoinStatus == ParticipantJoinStatus.Left))
            .OrderByDescending(x => x.JoinedAt)
            .ToListAsync();

        if (!myParticipants.Any())
        {
            return Enumerable.Empty<PlayerSessionHistoryItemDto>();
        }

        var participantIds = myParticipants.Select(x => x.Id).ToList();
        var sessionIds = myParticipants.Select(x => x.GameSessionId).Distinct().ToList();

        var participantAnswers = await _context.Set<PlayerAnswer>()
            .AsNoTracking()
            .Where(x => participantIds.Contains(x.ParticipantId) && !x.IsDeleted)
            .ToListAsync();

        var sessionParticipants = await _context.Set<GameParticipant>()
            .AsNoTracking()
            .Where(x =>
                sessionIds.Contains(x.GameSessionId) &&
                !x.IsDeleted &&
                (x.JoinStatus == ParticipantJoinStatus.Approved || x.JoinStatus == ParticipantJoinStatus.Left))
            .ToListAsync();

        var rankLookup = sessionParticipants
            .GroupBy(x => x.GameSessionId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .OrderByDescending(x => x.TotalScore)
                    .ThenBy(x => x.JoinedAt)
                    .Select((p, idx) => new { p.Id, Rank = idx + 1 })
                    .ToDictionary(x => x.Id, x => x.Rank)
            );

        var participantsCountLookup = sessionParticipants
            .GroupBy(x => x.GameSessionId)
            .ToDictionary(g => g.Key, g => g.Count());

        return myParticipants.Select(participant =>
        {
            var answers = participantAnswers.Where(x => x.ParticipantId == participant.Id).ToList();
            var rank = participant.Rank;
            if (!rank.HasValue &&
                rankLookup.TryGetValue(participant.GameSessionId, out var sessionRanks) &&
                sessionRanks.TryGetValue(participant.Id, out var calculatedRank))
            {
                rank = calculatedRank;
            }

            return new PlayerSessionHistoryItemDto
            {
                SessionId = participant.GameSessionId,
                QuizId = participant.GameSession.QuizId,
                QuizTitle = participant.GameSession.Quiz.Title,
                SessionStatus = participant.GameSession.Status,
                SessionStartedAt = participant.GameSession.StartedAt,
                SessionEndedAt = participant.GameSession.EndedAt,
                JoinedAt = participant.JoinedAt,
                DisplayName = participant.DisplayName,
                TotalScore = participant.TotalScore,
                Rank = rank,
                TotalParticipants = participantsCountLookup.TryGetValue(participant.GameSessionId, out var count) ? count : 0,
                CorrectAnswers = answers.Count(x => x.IsCorrect),
                WrongAnswers = answers.Count(x => !x.IsCorrect),
                AverageResponseTimeMs = answers.Count == 0 ? 0 : answers.Average(x => x.ResponseTimeMs ?? 0)
            };
        }).ToList();
    }
}
