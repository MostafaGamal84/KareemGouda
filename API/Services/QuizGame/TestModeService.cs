using API.Data;
using API.DTOs.QuizGame;
using API.Entities.QuizGame;
using API.Interfaces.QuizGame;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace API.Services.QuizGame;

public class TestModeService : ITestModeService
{
    private readonly DataContext _context;

    public TestModeService(DataContext context)
    {
        _context = context;
    }

    public async Task<TestAttemptResponseDto?> StartAsync(int quizId, int? userId, StartTestAttemptDto dto)
    {
        var quiz = await _context.Set<Quiz>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == quizId && !x.IsDeleted && x.Mode == QuizMode.Test && x.IsPublished);

        if (quiz is null)
        {
            return null;
        }

        var maxAttempts = quiz.MaxAttempts > 0 ? quiz.MaxAttempts : 1;

        if (userId.HasValue)
        {
            var existingActiveAttempt = await _context.Set<QuizAttempt>()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.QuizId == quizId && x.UserId == userId && !x.IsFinished && !x.IsDeleted);

            if (existingActiveAttempt != null)
            {
                return new TestAttemptResponseDto
                {
                    AttemptId = existingActiveAttempt.Id,
                    QuizId = quizId,
                    CurrentQuestionIndex = existingActiveAttempt.CurrentQuestionIndex,
                    IsFinished = existingActiveAttempt.IsFinished,
                    Allowed = true,
                    Message = "You have an active attempt. Resuming..."
                };
            }

            var completedAttemptsCount = await _context.Set<QuizAttempt>()
                .AsNoTracking()
                .CountAsync(x => x.QuizId == quizId && x.UserId == userId && x.IsFinished && !x.IsDeleted);

            if (completedAttemptsCount >= maxAttempts)
            {
                return new TestAttemptResponseDto
                {
                    AttemptId = 0,
                    QuizId = quizId,
                    Allowed = false,
                    Message = $"You have reached the maximum number of attempts ({maxAttempts}) for this quiz."
                };
            }
        }

        var attempt = new QuizAttempt
        {
            QuizId = quizId,
            UserId = userId,
            ParticipantName = dto.ParticipantName,
            StartedAt = DateTime.UtcNow,
            IsFinished = false,
            TotalScore = 0,
            CurrentQuestionIndex = 0,
            IsDeleted = false,
            TimerStartedAt = DateTime.UtcNow,
            ElapsedSeconds = 0
        };

        _context.Set<QuizAttempt>().Add(attempt);
        await _context.SaveChangesAsync();

        return new TestAttemptResponseDto
        {
            AttemptId = attempt.Id,
            QuizId = attempt.QuizId,
            CurrentQuestionIndex = attempt.CurrentQuestionIndex,
            IsFinished = attempt.IsFinished,
            Allowed = true
        };
    }

    public async Task<TestAttemptOverviewDto?> GetAttemptOverviewAsync(int attemptId, int userId, bool canAccessAll)
    {
        var attempt = await AccessibleAttempts(userId, canAccessAll)
            .AsNoTracking()
            .Include(x => x.Quiz)
            .FirstOrDefaultAsync(x => x.Id == attemptId);

        if (attempt is null)
        {
            return null;
        }

        var orderedQuestions = await _context.Set<QuizQuestion>()
            .AsNoTracking()
            .Include(x => x.Question)
            .Where(x => x.QuizId == attempt.QuizId && !x.IsDeleted)
            .OrderBy(x => x.Order)
            .ToListAsync();

        var answeredQuestionIds = await _context.Set<QuizAttemptAnswer>()
            .AsNoTracking()
            .Where(x => x.QuizAttemptId == attemptId && !x.IsDeleted)
            .Select(x => x.QuestionId)
            .ToListAsync();

        var answeredSet = answeredQuestionIds.ToHashSet();
        var totalQuestions = orderedQuestions.Count;
        var currentIndex = ResolveOverviewQuestionIndex(attempt.CurrentQuestionIndex, orderedQuestions, answeredSet);

        var elapsedSeconds = attempt.TimerStartedAt.HasValue
            ? (int)Math.Round((DateTime.UtcNow - attempt.TimerStartedAt.Value).TotalSeconds)
            : attempt.ElapsedSeconds ?? 0;

        return new TestAttemptOverviewDto
        {
            AttemptId = attempt.Id,
            QuizId = attempt.QuizId,
            QuizTitle = attempt.Quiz.Title,
            IsFinished = attempt.IsFinished,
            DurationMinutes = attempt.Quiz.DurationMinutes,
            CurrentQuestionIndex = currentIndex,
            TotalQuestions = totalQuestions,
            AnsweredQuestions = answeredSet.Count,
            RemainingQuestions = Math.Max(0, totalQuestions - answeredSet.Count),
            TimerStartedAt = attempt.TimerStartedAt,
            ElapsedSeconds = elapsedSeconds,
            Questions = orderedQuestions.Select((qq, index) => new TestAttemptQuestionItemDto
            {
                QuestionIndex = index,
                QuestionId = qq.QuestionId,
                Title = qq.Question?.Title ?? $"Question {index + 1}",
                IsAnswered = answeredSet.Contains(qq.QuestionId),
                IsCurrent = index == currentIndex
            }).ToList()
        };
    }

    public async Task<List<TestModeQuestionDto>> GetQuestionsAsync(int attemptId, int userId, bool canAccessAll)
    {
        var attempt = await AccessibleAttempts(userId, canAccessAll)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == attemptId);

        if (attempt is null)
        {
            return new List<TestModeQuestionDto>();
        }

        var orderedQuestions = await _context.Set<QuizQuestion>()
            .AsNoTracking()
            .Where(x => x.QuizId == attempt.QuizId && !x.IsDeleted)
            .OrderBy(x => x.Order)
            .Include(x => x.Question)
            .ThenInclude(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.Question)
            .ThenInclude(x => x.QuestionCategoryAssignments)
            .ThenInclude(x => x.Category)
            .ToListAsync();

        if (!orderedQuestions.Any())
        {
            return new List<TestModeQuestionDto>();
        }

        var answers = await _context.Set<QuizAttemptAnswer>()
            .AsNoTracking()
            .Where(x => x.QuizAttemptId == attemptId && !x.IsDeleted)
            .ToListAsync();

        var answersLookup = answers.ToDictionary(x => x.QuestionId, x => x);

        return orderedQuestions
            .Select((quizQuestion, index) => MapTestQuestion(
                attempt.IsFinished,
                quizQuestion,
                answersLookup.TryGetValue(quizQuestion.QuestionId, out var answer) ? answer : null,
                index,
                orderedQuestions.Count))
            .ToList();
    }

    public async Task<TestModeQuestionDto?> GetCurrentQuestionAsync(int attemptId, int userId, int? questionIndex, bool canAccessAll)
    {
        var attempt = await AccessibleAttempts(userId, canAccessAll)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == attemptId);

        if (attempt is null)
        {
            return null;
        }

        var orderedQuestions = await _context.Set<QuizQuestion>()
            .AsNoTracking()
            .Where(x => x.QuizId == attempt.QuizId && !x.IsDeleted)
            .OrderBy(x => x.Order)
            .Include(x => x.Question)
            .ThenInclude(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.Question)
            .ThenInclude(x => x.QuestionCategoryAssignments)
            .ThenInclude(x => x.Category)
            .ToListAsync();

        if (!orderedQuestions.Any())
        {
            return null;
        }

        var answeredQuestionIds = await _context.Set<QuizAttemptAnswer>()
            .AsNoTracking()
            .Where(x => x.QuizAttemptId == attemptId && !x.IsDeleted)
            .Select(x => x.QuestionId)
            .ToListAsync();

        var answeredSet = answeredQuestionIds.ToHashSet();
        int? resolvedIndex = questionIndex.HasValue
            ? ResolveRequestedQuestionIndex(questionIndex.Value, orderedQuestions.Count)
            : ResolveDefaultQuestionIndex(attempt.CurrentQuestionIndex, orderedQuestions, answeredSet);

        if (!resolvedIndex.HasValue)
        {
            return null;
        }

        var quizQuestion = orderedQuestions[resolvedIndex.Value];
        var answer = await _context.Set<QuizAttemptAnswer>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.QuizAttemptId == attemptId && x.QuestionId == quizQuestion.QuestionId && !x.IsDeleted);

        return MapTestQuestion(attempt.IsFinished, quizQuestion, answer, resolvedIndex.Value, orderedQuestions.Count);
    }

    public async Task<TestAnswerSubmitResponseDto> SubmitAnswerAsync(int attemptId, int userId, SubmitTestAnswerDto dto, bool canAccessAll)
    {
        var attempt = await AccessibleAttempts(userId, canAccessAll).FirstOrDefaultAsync(x => x.Id == attemptId);
        if (attempt is null || attempt.IsFinished)
        {
            return Rejected("Attempt is not active.");
        }

        var orderedQuestions = await _context.Set<QuizQuestion>()
            .AsNoTracking()
            .Where(x => x.QuizId == attempt.QuizId && !x.IsDeleted)
            .OrderBy(x => x.Order)
            .ToListAsync();

        var currentQuizQuestion = orderedQuestions.FirstOrDefault(x => x.QuestionId == dto.QuestionId);
        if (currentQuizQuestion is null)
        {
            return Rejected("Question not found in this attempt.");
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

        var existingAnswer = await _context.Set<QuizAttemptAnswer>()
            .FirstOrDefaultAsync(x => x.QuizAttemptId == attemptId && x.QuestionId == dto.QuestionId && !x.IsDeleted);

        var normalizedChoiceIds = NormalizeSelectedChoiceIds(question, dto.SelectedChoiceId, dto.SelectedChoiceIds);
        var isCorrect = EvaluateAnswer(question, dto);
        var score = isCorrect ? (currentQuizQuestion.PointsOverride ?? question.Points) : 0;

        if (existingAnswer is null)
        {
            _context.Set<QuizAttemptAnswer>().Add(new QuizAttemptAnswer
            {
                QuizAttemptId = attemptId,
                QuestionId = dto.QuestionId,
                SelectedChoiceId = normalizedChoiceIds.Count == 1 ? normalizedChoiceIds[0] : null,
                SelectedChoiceIdsJson = SerializeSelectedChoiceIds(normalizedChoiceIds),
                TextAnswer = question.Type == QuestionType.ShortAnswer ? dto.TextAnswer?.Trim() : null,
                IsCorrect = isCorrect,
                ScoreAwarded = score,
                AnsweredAt = DateTime.UtcNow,
                IsDeleted = false
            });
        }
        else
        {
            existingAnswer.SelectedChoiceId = normalizedChoiceIds.Count == 1 ? normalizedChoiceIds[0] : null;
            existingAnswer.SelectedChoiceIdsJson = SerializeSelectedChoiceIds(normalizedChoiceIds);
            existingAnswer.TextAnswer = question.Type == QuestionType.ShortAnswer ? dto.TextAnswer?.Trim() : null;
            existingAnswer.IsCorrect = isCorrect;
            existingAnswer.ScoreAwarded = score;
            existingAnswer.AnsweredAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        var answeredQuestionIds = await _context.Set<QuizAttemptAnswer>()
            .AsNoTracking()
            .Where(x => x.QuizAttemptId == attemptId && !x.IsDeleted)
            .Select(x => x.QuestionId)
            .ToListAsync();

        attempt.TotalScore = await _context.Set<QuizAttemptAnswer>()
            .Where(x => x.QuizAttemptId == attemptId && !x.IsDeleted)
            .SumAsync(x => (int?)x.ScoreAwarded) ?? 0;

        var answeredSet = answeredQuestionIds.ToHashSet();
        var nextIndex = FindNextUnansweredQuestionIndex(orderedQuestions, answeredSet, dto.QuestionId);
        var currentIndex = orderedQuestions.FindIndex(x => x.QuestionId == dto.QuestionId);
        attempt.CurrentQuestionIndex = nextIndex ?? Math.Max(currentIndex, 0);

        await _context.SaveChangesAsync();

        return new TestAnswerSubmitResponseDto
        {
            Accepted = true,
            IsCorrect = null,
            SelectedChoiceId = normalizedChoiceIds.Count == 1 ? normalizedChoiceIds[0] : null,
            SelectedChoiceIds = normalizedChoiceIds,
            CorrectChoiceId = null,
            CorrectChoiceIds = new List<int>(),
            NextQuestionIndex = nextIndex,
            AnsweredQuestions = answeredSet.Count,
            RemainingQuestions = Math.Max(0, orderedQuestions.Count - answeredSet.Count),
            Message = existingAnswer is null ? "Answer saved" : "Answer updated"
        };
    }

    public async Task<TestResultDto?> FinishAsync(int attemptId, int userId, FinishTestAttemptDto dto, bool canAccessAll)
    {
        var attempt = await AccessibleAttempts(userId, canAccessAll).FirstOrDefaultAsync(x => x.Id == attemptId);
        if (attempt is null)
        {
            return null;
        }

        if (attempt.IsFinished)
        {
            return await GetResultAsync(attemptId, userId, canAccessAll);
        }

        var orderedQuestions = await _context.Set<QuizQuestion>()
            .Where(x => x.QuizId == attempt.QuizId && !x.IsDeleted)
            .OrderBy(x => x.Order)
            .Include(x => x.Question)
            .ThenInclude(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.Question)
            .ThenInclude(x => x.QuestionCategoryAssignments)
            .ThenInclude(x => x.Category)
            .ToListAsync();

        var questionsById = orderedQuestions.ToDictionary(x => x.QuestionId, x => x);
        var existingAnswers = await _context.Set<QuizAttemptAnswer>()
            .Where(x => x.QuizAttemptId == attemptId && !x.IsDeleted)
            .ToListAsync();
        var existingAnswersByQuestionId = existingAnswers.ToDictionary(x => x.QuestionId, x => x);
        var submittedQuestionIds = new HashSet<int>();

        var submittedAnswers = (dto.Answers ?? new List<SubmitTestAnswerDto>())
            .Where(x => x.QuestionId > 0)
            .GroupBy(x => x.QuestionId)
            .Select(g => g.Last())
            .ToList();

        foreach (var submission in submittedAnswers)
        {
            if (!questionsById.TryGetValue(submission.QuestionId, out var quizQuestion))
            {
                continue;
            }

            var question = quizQuestion.Question;
            if (!TryNormalizeFinishAnswer(question, submission, out var normalizedChoiceIds, out var normalizedTextAnswer))
            {
                continue;
            }

            submittedQuestionIds.Add(submission.QuestionId);

            var normalizedSubmission = new SubmitTestAnswerDto
            {
                QuestionId = submission.QuestionId,
                SelectedChoiceId = normalizedChoiceIds.Count == 1 ? normalizedChoiceIds[0] : null,
                SelectedChoiceIds = normalizedChoiceIds,
                TextAnswer = normalizedTextAnswer
            };

            var isCorrect = EvaluateAnswer(question, normalizedSubmission);
            var score = isCorrect ? (quizQuestion.PointsOverride ?? question.Points) : 0;

            if (!existingAnswersByQuestionId.TryGetValue(submission.QuestionId, out var answer))
            {
                answer = new QuizAttemptAnswer
                {
                    QuizAttemptId = attemptId,
                    QuestionId = submission.QuestionId,
                    SelectedChoiceId = normalizedChoiceIds.Count == 1 ? normalizedChoiceIds[0] : null,
                    SelectedChoiceIdsJson = SerializeSelectedChoiceIds(normalizedChoiceIds),
                    TextAnswer = normalizedTextAnswer,
                    IsCorrect = isCorrect,
                    ScoreAwarded = score,
                    AnsweredAt = DateTime.UtcNow,
                    IsDeleted = false
                };

                _context.Set<QuizAttemptAnswer>().Add(answer);
                existingAnswers.Add(answer);
                existingAnswersByQuestionId[submission.QuestionId] = answer;
                continue;
            }

            answer.IsDeleted = false;
            answer.SelectedChoiceId = normalizedChoiceIds.Count == 1 ? normalizedChoiceIds[0] : null;
            answer.SelectedChoiceIdsJson = SerializeSelectedChoiceIds(normalizedChoiceIds);
            answer.TextAnswer = normalizedTextAnswer;
            answer.IsCorrect = isCorrect;
            answer.ScoreAwarded = score;
            answer.AnsweredAt = DateTime.UtcNow;
        }

        foreach (var answer in existingAnswers)
        {
            if (submittedQuestionIds.Contains(answer.QuestionId))
            {
                continue;
            }

            answer.IsDeleted = true;
        }

        attempt.TotalScore = existingAnswers.Where(x => !x.IsDeleted).Sum(x => x.ScoreAwarded);
        attempt.IsFinished = true;
        attempt.EndedAt = DateTime.UtcNow;
        attempt.CurrentQuestionIndex = orderedQuestions.Count > 0 ? orderedQuestions.Count - 1 : 0;

        await _context.SaveChangesAsync();

        if (attempt.UserId.HasValue)
        {
            var access = await _context.Set<QuizAccess>()
                .Include(x => x.AccessUsers)
                .FirstOrDefaultAsync(a => a.QuizId == attempt.QuizId && !a.IsDeleted);

            if (access != null && access.AccessType == ExamAccessType.Custom)
            {
                var accessUser = access.AccessUsers.FirstOrDefault(u => u.UserId == attempt.UserId.Value);
                if (accessUser != null && accessUser.Status == AccessRequestStatus.Approved)
                {
                    accessUser.AttemptCount++;
                    await _context.SaveChangesAsync();
                }
            }
        }

        return await GetResultAsync(attemptId, userId, canAccessAll);
    }

    public async Task<TestResultDto?> GetResultAsync(int attemptId, int userId, bool canAccessAll)
    {
        var attempt = await AccessibleAttempts(userId, canAccessAll)
            .AsNoTracking()
            .Include(x => x.Quiz)
            .FirstOrDefaultAsync(x => x.Id == attemptId);

        if (attempt is null)
        {
            return null;
        }

        var answers = await _context.Set<QuizAttemptAnswer>()
            .AsNoTracking()
            .Where(x => x.QuizAttemptId == attemptId && !x.IsDeleted)
            .ToListAsync();

        var orderedQuestions = await _context.Set<QuizQuestion>()
            .AsNoTracking()
            .Where(x => x.QuizId == attempt.QuizId && !x.IsDeleted)
            .OrderBy(x => x.Order)
            .Include(x => x.Question)
            .ThenInclude(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.Question)
            .ThenInclude(x => x.QuestionCategoryAssignments)
            .ThenInclude(x => x.Category)
            .ToListAsync();

        var answersLookup = answers.ToDictionary(x => x.QuestionId, x => x);
        var totalQuestions = orderedQuestions.Count;
        var correctAnswers = answers.Count(x => x.IsCorrect);
        var answeredQuestions = answers.Count;
        var wrongAnswers = Math.Max(0, totalQuestions - correctAnswers);
        var accuracyPercent = totalQuestions == 0 ? 0 : (double)correctAnswers / totalQuestions * 100.0;
        int? durationSeconds = attempt.EndedAt.HasValue
            ? Math.Max(0, (int)Math.Round((attempt.EndedAt.Value - attempt.StartedAt).TotalSeconds))
            : null;

        var reviewQuestions = orderedQuestions
            .Select((quizQuestion, index) => BuildQuestionReview(
                index,
                quizQuestion,
                answersLookup.TryGetValue(quizQuestion.QuestionId, out var answer) ? answer : null))
            .ToList();

        var incorrectQuestions = reviewQuestions
            .Where(x => !x.IsCorrect)
            .ToList();

        return new TestResultDto
        {
            AttemptId = attempt.Id,
            QuizId = attempt.QuizId,
            QuizTitle = attempt.Quiz.Title,
            ParticipantName = attempt.ParticipantName,
            TotalScore = attempt.TotalScore,
            TotalQuestions = totalQuestions,
            AnsweredQuestions = answeredQuestions,
            UnansweredQuestions = Math.Max(0, totalQuestions - answeredQuestions),
            CorrectAnswers = correctAnswers,
            WrongAnswers = wrongAnswers,
            AccuracyPercent = accuracyPercent,
            StartedAt = attempt.StartedAt,
            EndedAt = attempt.EndedAt,
            DurationSeconds = durationSeconds,
            ReviewQuestions = reviewQuestions,
            IncorrectQuestions = incorrectQuestions
        };
    }

    public async Task<IEnumerable<PlayerTestHistoryItemDto>> GetMyHistoryAsync(int userId)
    {
        var attempts = await _context.Set<QuizAttempt>()
            .AsNoTracking()
            .Include(x => x.Quiz)
            .Where(x => x.UserId == userId && !x.IsDeleted && x.IsFinished)
            .OrderByDescending(x => x.EndedAt ?? x.StartedAt)
            .ToListAsync();

        if (!attempts.Any())
        {
            return Enumerable.Empty<PlayerTestHistoryItemDto>();
        }

        var attemptIds = attempts.Select(x => x.Id).ToList();
        var quizIds = attempts.Select(x => x.QuizId).Distinct().ToList();

        var answerStats = await _context.Set<QuizAttemptAnswer>()
            .AsNoTracking()
            .Where(x => attemptIds.Contains(x.QuizAttemptId) && !x.IsDeleted)
            .GroupBy(x => x.QuizAttemptId)
            .Select(g => new
            {
                AttemptId = g.Key,
                Answered = g.Count(),
                Correct = g.Count(x => x.IsCorrect),
                Wrong = g.Count(x => !x.IsCorrect)
            })
            .ToListAsync();

        var questionStats = await _context.Set<QuizQuestion>()
            .AsNoTracking()
            .Where(x => quizIds.Contains(x.QuizId) && !x.IsDeleted)
            .GroupBy(x => x.QuizId)
            .Select(g => new
            {
                QuizId = g.Key,
                Count = g.Count()
            })
            .ToListAsync();

        var answersLookup = answerStats.ToDictionary(x => x.AttemptId, x => x);
        var questionLookup = questionStats.ToDictionary(x => x.QuizId, x => x.Count);

        return attempts.Select(attempt =>
        {
            answersLookup.TryGetValue(attempt.Id, out var stats);
            var answered = stats?.Answered ?? 0;
            var correct = stats?.Correct ?? 0;
            var totalQuestions = questionLookup.TryGetValue(attempt.QuizId, out var count) ? count : 0;
            var wrong = Math.Max(0, totalQuestions - correct);
            var accuracyPercent = totalQuestions == 0 ? 0 : (double)correct / totalQuestions * 100.0;
            int? durationSeconds = attempt.EndedAt.HasValue
                ? Math.Max(0, (int)Math.Round((attempt.EndedAt.Value - attempt.StartedAt).TotalSeconds))
                : null;

            return new PlayerTestHistoryItemDto
            {
                AttemptId = attempt.Id,
                QuizId = attempt.QuizId,
                QuizTitle = attempt.Quiz.Title,
                ParticipantName = attempt.ParticipantName,
                TotalScore = attempt.TotalScore,
                TotalQuestions = totalQuestions,
                AnsweredQuestions = answered,
                CorrectAnswers = correct,
                WrongAnswers = wrong,
                AccuracyPercent = accuracyPercent,
                StartedAt = attempt.StartedAt,
                EndedAt = attempt.EndedAt,
                DurationSeconds = durationSeconds
            };
        }).ToList();
    }

    private IQueryable<QuizAttempt> AccessibleAttempts(int userId, bool canAccessAll)
    {
        return _context.Set<QuizAttempt>()
            .Where(x => !x.IsDeleted && (canAccessAll || x.UserId == userId));
    }

    private static bool TryNormalizeFinishAnswer(Question question, SubmitTestAnswerDto dto, out List<int> selectedChoiceIds, out string? textAnswer)
    {
        selectedChoiceIds = new List<int>();
        textAnswer = null;

        if (question.Type == QuestionType.ShortAnswer)
        {
            var trimmed = dto.TextAnswer?.Trim();
            if (string.IsNullOrWhiteSpace(trimmed))
            {
                return false;
            }

            textAnswer = trimmed;
            return true;
        }

        selectedChoiceIds = NormalizeSelectedChoiceIds(question, dto.SelectedChoiceId, dto.SelectedChoiceIds);
        if (selectedChoiceIds.Count == 0)
        {
            return false;
        }

        var validChoiceIds = question.Choices.Select(x => x.Id).ToHashSet();
        return selectedChoiceIds.All(validChoiceIds.Contains);
    }

    private static string? ValidateSubmission(Question question, SubmitTestAnswerDto dto)
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

    private static TestModeQuestionDto MapTestQuestion(bool isAttemptFinished, QuizQuestion quizQuestion, QuizAttemptAnswer? answer, int questionIndex, int totalQuestions)
    {
        var question = quizQuestion.Question;
        var categories = question.QuestionCategoryAssignments
            .Where(link => !link.IsDeleted && !link.Category.IsDeleted)
            .OrderBy(link => link.Category.Name)
            .Select(link => new QuestionCategoryRefDto
            {
                Id = link.CategoryId,
                Name = link.Category.Name
            })
            .ToList();
        var primaryCategoryId = question.CategoryId.HasValue && question.CategoryId.Value > 0
            ? question.CategoryId
            : categories.FirstOrDefault()?.Id;
        var primaryCategoryName = categories.FirstOrDefault(category => category.Id == primaryCategoryId)?.Name
            ?? categories.FirstOrDefault()?.Name;
        var selectedChoiceIds = DeserializeSelectedChoiceIds(answer?.SelectedChoiceIdsJson, answer?.SelectedChoiceId);
        var correctChoiceIds = !isAttemptFinished || question.Type == QuestionType.ShortAnswer
            ? new List<int>()
            : question.Choices
                .Where(x => x.IsCorrect)
                .OrderBy(x => x.Order)
                .Select(x => x.Id)
                .ToList();

        return new TestModeQuestionDto
        {
            QuestionIndex = questionIndex,
            TotalQuestions = totalQuestions,
            IsAnswered = answer is not null,
            SelectedChoiceId = selectedChoiceIds.Count == 1 ? selectedChoiceIds[0] : answer?.SelectedChoiceId,
            SelectedChoiceIds = selectedChoiceIds,
            TextAnswer = answer?.TextAnswer,
            IsCorrect = isAttemptFinished ? answer?.IsCorrect : null,
            CorrectChoiceId = correctChoiceIds.Count == 1 ? correctChoiceIds[0] : null,
            CorrectChoiceIds = correctChoiceIds,
            Question = new QuestionResponseDto
            {
                Id = question.Id,
                Title = question.Title,
                Text = question.Text,
                Type = question.Type,
                SelectionMode = question.SelectionMode,
                Difficulty = question.Difficulty,
                ImageUrl = GetQuestionImageUrl(question.Id),
                Explanation = question.Explanation,
                Points = quizQuestion.PointsOverride ?? question.Points,
                AnswerSeconds = quizQuestion.AnswerSeconds > 0 ? quizQuestion.AnswerSeconds : question.AnswerSeconds,
                CreatedBy = question.CreatedBy,
                CreatedAt = question.CreatedAt,
                CategoryId = primaryCategoryId,
                CategoryName = primaryCategoryName,
                Categories = categories,
                Choices = question.Type == QuestionType.ShortAnswer
                    ? new List<QuestionChoiceDto>()
                    : question.Choices.OrderBy(c => c.Order).Select(c =>
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
            }
        };
    }

    private static int ResolveOverviewQuestionIndex(int storedIndex, IReadOnlyList<QuizQuestion> orderedQuestions, HashSet<int> answeredQuestionIds)
    {
        if (!orderedQuestions.Any())
        {
            return 0;
        }

        if (storedIndex >= 0 && storedIndex < orderedQuestions.Count)
        {
            return storedIndex;
        }

        var firstUnanswered = FindFirstUnansweredQuestionIndex(orderedQuestions, answeredQuestionIds);
        return firstUnanswered ?? Math.Max(0, orderedQuestions.Count - 1);
    }

    private static int? ResolveDefaultQuestionIndex(int storedIndex, IReadOnlyList<QuizQuestion> orderedQuestions, HashSet<int> answeredQuestionIds)
    {
        if (!orderedQuestions.Any())
        {
            return null;
        }

        if (storedIndex >= 0 && storedIndex < orderedQuestions.Count)
        {
            return storedIndex;
        }

        return FindFirstUnansweredQuestionIndex(orderedQuestions, answeredQuestionIds);
    }

    private static int? ResolveRequestedQuestionIndex(int questionIndex, int totalQuestions)
    {
        if (questionIndex < 0 || questionIndex >= totalQuestions)
        {
            return null;
        }

        return questionIndex;
    }

    private static int? FindFirstUnansweredQuestionIndex(IReadOnlyList<QuizQuestion> orderedQuestions, HashSet<int> answeredQuestionIds)
    {
        for (var i = 0; i < orderedQuestions.Count; i++)
        {
            if (!answeredQuestionIds.Contains(orderedQuestions[i].QuestionId))
            {
                return i;
            }
        }

        return null;
    }

    private static int? FindNextUnansweredQuestionIndex(IReadOnlyList<QuizQuestion> orderedQuestions, HashSet<int> answeredQuestionIds, int currentQuestionId)
    {
        if (!orderedQuestions.Any())
        {
            return null;
        }

        var currentIndex = orderedQuestions.Select((qq, index) => new { qq.QuestionId, Index = index })
            .FirstOrDefault(x => x.QuestionId == currentQuestionId)?.Index ?? -1;

        if (currentIndex < 0)
        {
            return FindFirstUnansweredQuestionIndex(orderedQuestions, answeredQuestionIds);
        }

        for (var offset = 1; offset <= orderedQuestions.Count; offset++)
        {
            var index = (currentIndex + offset) % orderedQuestions.Count;
            if (!answeredQuestionIds.Contains(orderedQuestions[index].QuestionId))
            {
                return index;
            }
        }

        return null;
    }

    private static TestResultReviewItemDto BuildQuestionReview(int questionIndex, QuizQuestion quizQuestion, QuizAttemptAnswer? answer)
    {
        var question = quizQuestion.Question;
        var orderedChoices = question.Choices.OrderBy(x => x.Order).ToList();
        var selectedChoiceIds = DeserializeSelectedChoiceIds(answer?.SelectedChoiceIdsJson, answer?.SelectedChoiceId);
        var selectedAnswerText = question.Type == QuestionType.ShortAnswer
            ? answer?.TextAnswer?.Trim()
            : string.Join(", ", orderedChoices
                .Where(x => selectedChoiceIds.Contains(x.Id))
                .Select(GetChoiceReviewLabel));
        var correctAnswerText = string.Join(", ", orderedChoices.Where(x => x.IsCorrect).Select(GetChoiceReviewLabel));

        return new TestResultReviewItemDto
        {
            QuestionIndex = questionIndex,
            QuestionId = question.Id,
            QuestionTitle = question.Title,
            QuestionText = question.Text,
            IsAnswered = answer is not null,
            IsCorrect = answer?.IsCorrect == true,
            SelectedAnswerText = string.IsNullOrWhiteSpace(selectedAnswerText) ? null : selectedAnswerText,
            CorrectAnswerText = correctAnswerText,
            Explanation = question.Explanation
        };
    }

    private static bool EvaluateAnswer(Question question, SubmitTestAnswerDto dto)
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

    private static TestAnswerSubmitResponseDto Rejected(string message)
    {
        return new TestAnswerSubmitResponseDto
        {
            Accepted = false,
            IsCorrect = null,
            SelectedChoiceId = null,
            SelectedChoiceIds = new List<int>(),
            CorrectChoiceId = null,
            CorrectChoiceIds = new List<int>(),
            NextQuestionIndex = null,
            AnsweredQuestions = 0,
            RemainingQuestions = 0,
            Message = message
        };
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

    private static List<int> DeserializeSelectedChoiceIds(string? selectedChoiceIdsJson, int? selectedChoiceId)
    {
        if (!string.IsNullOrWhiteSpace(selectedChoiceIdsJson))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<List<int>>(selectedChoiceIdsJson);
                if (parsed is { Count: > 0 })
                {
                    return parsed.Where(x => x > 0).Distinct().OrderBy(x => x).ToList();
                }
            }
            catch
            {
            }
        }

        return selectedChoiceId.HasValue && selectedChoiceId.Value > 0
            ? new List<int> { selectedChoiceId.Value }
            : new List<int>();
    }

    private static string GetQuestionImageUrl(int questionId)
    {
        var uploadsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "questions");
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

    private static string GetChoiceImageUrl(int choiceId)
    {
        var uploadsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "question-choices");
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

    private static string GetChoiceReviewLabel(QuestionChoice choice)
    {
        if (!string.IsNullOrWhiteSpace(choice.ChoiceText))
        {
            return choice.ChoiceText;
        }

        return $"Option {choice.Order}";
    }
}












