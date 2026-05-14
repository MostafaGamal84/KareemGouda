using API.Data;
using API.DTOs.QuizGame;
using API.Entities.QuizGame;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace API.Services.QuizGame;

public class QuizService : IQuizService
{
    private readonly DataContext _context;
    private readonly IWebHostEnvironment _environment;
    private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };
    private const long MaxCoverSizeBytes = 5 * 1024 * 1024;

    public QuizService(DataContext context, IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    public async Task<QuizResponseDto> CreateAsync(QuizCreateUpdateDto dto, int? userId)
    {
        ValidateQuiz(dto);

        var quiz = new Quiz
        {
            Title = dto.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            Mode = dto.Mode,
            DurationMinutes = NormalizeDurationMinutes(dto.DurationMinutes),
            TotalMarks = NormalizeTotalMarks(dto.TotalMarks),
            IsPublished = dto.IsPublished,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        _context.Set<Quiz>().Add(quiz);
        await _context.SaveChangesAsync();

        await SyncCategoriesAsync(quiz.Id, dto.Categories);
        await _context.SaveChangesAsync();

        return await GetByIdAsync(quiz.Id) ?? throw new InvalidOperationException("Quiz was not created.");
    }

    public async Task<QuizResponseDto?> UpdateAsync(int id, QuizCreateUpdateDto dto)
    {
        ValidateQuiz(dto);

        var quiz = await _context.Set<Quiz>()
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (quiz is null)
        {
            return null;
        }

        quiz.Title = dto.Title.Trim();
        quiz.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        quiz.Mode = dto.Mode;
        quiz.DurationMinutes = NormalizeDurationMinutes(dto.DurationMinutes);
        quiz.TotalMarks = NormalizeTotalMarks(dto.TotalMarks);
        quiz.IsPublished = dto.IsPublished;

        await SyncCategoriesAsync(id, dto.Categories);
        await _context.SaveChangesAsync();

        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var quiz = await _context.Set<Quiz>().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
        if (quiz is null)
        {
            return false;
        }

        quiz.IsDeleted = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<QuizResponseDto?> GetByIdAsync(int id)
    {
        var quiz = await _context.Set<Quiz>()
            .AsNoTracking()
            .Include(x => x.QuizAccess)
            .Include(x => x.QuizCategories.Where(qc => !qc.IsDeleted))
            .ThenInclude(x => x.Category)
            .Include(x => x.QuizQuestions.Where(q => !q.IsDeleted).OrderBy(q => q.Order))
            .ThenInclude(x => x.Question)
            .ThenInclude(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.QuizQuestions.Where(q => !q.IsDeleted).OrderBy(q => q.Order))
            .ThenInclude(x => x.Question)
            .ThenInclude(x => x.QuestionCategoryAssignments)
            .ThenInclude(x => x.Category)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        return quiz is null ? null : MapQuizDetails(quiz);
    }

    public async Task<PagedResultDto<QuizResponseDto>> GetAllAsync(QuizQueryDto query)
    {
        var page = query.PageNumber <= 0 ? 1 : query.PageNumber;
        var size = query.PageSize <= 0 ? 10 : query.PageSize;

        var dbQuery = _context.Set<Quiz>()
            .AsNoTracking()
            .Include(x => x.QuizAccess)
            .Include(x => x.QuizQuestions.Where(q => !q.IsDeleted))
            .ThenInclude(x => x.Question)
            .ThenInclude(x => x.QuestionCategoryAssignments)
            .ThenInclude(x => x.Category)
            .Include(x => x.QuizCategories.Where(qc => !qc.IsDeleted))
            .ThenInclude(x => x.Category)
            .Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            dbQuery = dbQuery.Where(x =>
                x.Title.ToLower().Contains(search) ||
                (x.Description != null && x.Description.ToLower().Contains(search)));
        }

        if (query.Mode.HasValue)
        {
            dbQuery = dbQuery.Where(x => x.Mode == query.Mode.Value);
        }

        if (query.IsPublished.HasValue)
        {
            dbQuery = dbQuery.Where(x => x.IsPublished == query.IsPublished.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var category = query.Category.Trim().ToLower();
            dbQuery = dbQuery.Where(x => x.QuizCategories.Any(qc => !qc.IsDeleted && qc.Category.Name.ToLower().Contains(category)));
        }

        if (query.ExamMode.HasValue)
        {
            var examMode = query.ExamMode.Value;
            dbQuery = dbQuery.Where(x =>
                x.QuizAccess != null &&
                !x.QuizAccess.IsDeleted &&
                x.QuizAccess.ExamMode == examMode);
        }

        var total = await dbQuery.CountAsync();
        var items = await dbQuery
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync();

        return new PagedResultDto<QuizResponseDto>
        {
            PageNumber = page,
            PageSize = size,
            TotalCount = total,
            Items = items.Select(MapQuizSummary).ToList()
        };
    }

    public async Task<List<QuizCategoryDto>> GetCategoriesAsync()
    {
        return await _context.Set<Category>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name)
            .Select(x => new QuizCategoryDto
            {
                Id = x.Id,
                Name = x.Name
            })
            .ToListAsync();
    }

    public async Task<string?> UploadCoverImageAsync(int quizId, IFormFile file)
    {
        var quizExists = await _context.Set<Quiz>()
            .AsNoTracking()
            .AnyAsync(x => x.Id == quizId && !x.IsDeleted);

        if (!quizExists)
        {
            return null;
        }

        ValidateImageFile(file);

        var uploadsDirectory = EnsureImageDirectory("quizzes");
        DeleteExistingImages(quizId, uploadsDirectory, "quiz");

        var extension = Path.GetExtension(file.FileName)?.Trim().ToLowerInvariant() ?? ".png";
        var fileName = $"quiz-{quizId}{extension}";
        var fullPath = Path.Combine(uploadsDirectory, fileName);

        await using (var stream = File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        var relativePath = $"/uploads/quizzes/{fileName}";
        return AddVersion(relativePath, File.GetLastWriteTimeUtc(fullPath));
    }

    public async Task<bool> AddQuestionsAsync(int quizId, List<QuizQuestionAddDto> questions)
    {
        var quiz = await _context.Set<Quiz>()
            .Include(x => x.QuizQuestions)
            .FirstOrDefaultAsync(x => x.Id == quizId && !x.IsDeleted);

        if (quiz is null)
        {
            return false;
        }

        foreach (var item in questions)
        {
            var question = await _context.Set<Question>()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == item.QuestionId && !x.IsDeleted);
            if (question is null)
            {
                throw new ArgumentException($"Question {item.QuestionId} does not exist.");
            }

            var current = quiz.QuizQuestions.FirstOrDefault(x => x.QuestionId == item.QuestionId);
            var effectiveAnswerSeconds = NormalizeAnswerSeconds(item.AnswerSeconds ?? question.AnswerSeconds);
            if (current is null)
            {
                quiz.QuizQuestions.Add(new QuizQuestion
                {
                    QuestionId = item.QuestionId,
                    Order = item.Order,
                    PointsOverride = item.PointsOverride,
                    AnswerSeconds = effectiveAnswerSeconds,
                    IsDeleted = false
                });
                continue;
            }

            current.IsDeleted = false;
            current.Order = item.Order;
            current.PointsOverride = item.PointsOverride;
            current.AnswerSeconds = effectiveAnswerSeconds;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveQuestionAsync(int quizId, int quizQuestionId)
    {
        var quizQuestion = await _context.Set<QuizQuestion>()
            .FirstOrDefaultAsync(x => x.Id == quizQuestionId && x.QuizId == quizId && !x.IsDeleted);

        if (quizQuestion is null)
        {
            return false;
        }

        quizQuestion.IsDeleted = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ReorderAsync(int quizId, List<QuizQuestionReorderItemDto> items)
    {
        var quizQuestions = await _context.Set<QuizQuestion>()
            .Where(x => x.QuizId == quizId && !x.IsDeleted)
            .ToListAsync();

        if (quizQuestions.Count == 0)
        {
            return false;
        }

        foreach (var item in items)
        {
            var match = quizQuestions.FirstOrDefault(x => x.Id == item.QuizQuestionId);
            if (match is null)
            {
                continue;
            }

            match.Order = item.Order;
            if (item.AnswerSeconds.HasValue)
            {
                match.AnswerSeconds = NormalizeAnswerSeconds(item.AnswerSeconds);
            }
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> PublishAsync(int quizId, bool isPublished)
    {
        var quiz = await _context.Set<Quiz>()
            .Include(x => x.QuizAccess)
            .FirstOrDefaultAsync(x => x.Id == quizId && !x.IsDeleted);
        if (quiz is null)
        {
            return false;
        }

        if (quiz.QuizAccess is { IsDeleted: false } && quiz.QuizAccess.ExamMode == ExamMode.Live)
        {
            throw new InvalidOperationException(
                "This quiz is configured for live delivery. Use sessions to control availability, not publish.");
        }

        quiz.IsPublished = isPublished;

        if (isPublished && (quiz.QuizAccess is null || quiz.QuizAccess.IsDeleted))
        {
            var maxAttempts = quiz.MaxAttempts > 0 ? quiz.MaxAttempts : 1;
            var access = new QuizAccess
            {
                QuizId = quiz.Id,
                ExamMode = ExamMode.Test,
                AccessType = ExamAccessType.Public,
                MaxAttempts = maxAttempts,
                IsDeleted = false
            };
            _context.Set<QuizAccess>().Add(access);
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<QuizResponseDto?> DuplicateAsync(int quizId, int userId)
    {
        var originalQuiz = await _context.Set<Quiz>()
            .Include(x => x.QuizCategories.Where(qc => !qc.IsDeleted))
            .Include(x => x.QuizQuestions.Where(q => !q.IsDeleted))
            .ThenInclude(x => x.Question)
            .ThenInclude(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.QuizQuestions.Where(q => !q.IsDeleted))
            .ThenInclude(x => x.Question)
            .ThenInclude(x => x.QuestionCategoryAssignments)
            .FirstOrDefaultAsync(x => x.Id == quizId && !x.IsDeleted);

        if (originalQuiz is null)
        {
            return null;
        }

        var newQuiz = new Quiz
        {
            Title = $"{originalQuiz.Title} (Copy)",
            Description = originalQuiz.Description,
            Mode = originalQuiz.Mode,
            DurationMinutes = originalQuiz.DurationMinutes,
            TotalMarks = originalQuiz.TotalMarks,
            IsPublished = false,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        _context.Set<Quiz>().Add(newQuiz);
        await _context.SaveChangesAsync();

        foreach (var qc in originalQuiz.QuizCategories)
        {
            newQuiz.QuizCategories.Add(new QuizCategory
            {
                QuizId = newQuiz.Id,
                CategoryId = qc.CategoryId,
                IsDeleted = false
            });
        }

        var questionOrder = 1;
        foreach (var oqq in originalQuiz.QuizQuestions.OrderBy(x => x.Order))
        {
            var originalQuestion = oqq.Question;
            var newQuestion = new Question
            {
                Title = originalQuestion.Title,
                Text = originalQuestion.Text,
                Type = originalQuestion.Type,
                SelectionMode = originalQuestion.SelectionMode,
                Difficulty = originalQuestion.Difficulty,
                Explanation = originalQuestion.Explanation,
                Points = originalQuestion.Points,
                AnswerSeconds = originalQuestion.AnswerSeconds,
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false,
                CategoryId = originalQuestion.CategoryId,
                QuestionCategoryAssignments = originalQuestion.QuestionCategoryAssignments
                    .Select(link => new QuestionCategoryAssignment
                    {
                        CategoryId = link.CategoryId,
                        IsDeleted = false
                    })
                    .ToList()
            };

            foreach (var oc in originalQuestion.Choices.OrderBy(c => c.Order))
            {
                newQuestion.Choices.Add(new QuestionChoice
                {
                    ChoiceText = oc.ChoiceText,
                    IsCorrect = oc.IsCorrect,
                    Order = oc.Order,
                    IsDeleted = false
                });
            }

            _context.Set<Question>().Add(newQuestion);
            await _context.SaveChangesAsync();

            newQuiz.QuizQuestions.Add(new QuizQuestion
            {
                QuestionId = newQuestion.Id,
                Order = questionOrder++,
                PointsOverride = oqq.PointsOverride,
                AnswerSeconds = oqq.AnswerSeconds,
                IsDeleted = false
            });
        }

        var quizAccess = await _context.Set<QuizAccess>()
            .FirstOrDefaultAsync(x => x.QuizId == quizId && !x.IsDeleted);
        
        if (quizAccess is not null)
        {
            var newQuizAccess = new QuizAccess
            {
                QuizId = newQuiz.Id,
                ExamMode = quizAccess.ExamMode,
                AccessType = quizAccess.AccessType,
                MaxAttempts = quizAccess.MaxAttempts,
                TimerMinutes = quizAccess.TimerMinutes,
                IsDeleted = false
            };
            _context.Set<QuizAccess>().Add(newQuizAccess);
        }

        await _context.SaveChangesAsync();

        newQuiz.TotalMarks = newQuiz.QuizQuestions.Sum(qq => qq.PointsOverride ?? qq.Question.Points);
        await _context.SaveChangesAsync();

        return await GetByIdAsync(newQuiz.Id);
    }

    public async Task<int> AddCategoryToQuizzesAsync(IEnumerable<int> quizIds, string categoryName)
    {
        var ids = (quizIds ?? Enumerable.Empty<int>())
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        var normalizedCategory = NormalizeCategoryName(categoryName);
        if (ids.Count == 0 || string.IsNullOrWhiteSpace(normalizedCategory.Name))
        {
            return 0;
        }

        var existingQuizIds = await _context.Set<Quiz>()
            .Where(x => ids.Contains(x.Id) && !x.IsDeleted)
            .Select(x => x.Id)
            .ToListAsync();

        if (existingQuizIds.Count == 0)
        {
            return 0;
        }

        var category = await _context.Set<Category>()
            .FirstOrDefaultAsync(x => x.NormalizedName == normalizedCategory.NormalizedName);

        if (category is null)
        {
            category = new Category
            {
                Name = normalizedCategory.Name,
                NormalizedName = normalizedCategory.NormalizedName,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
            _context.Set<Category>().Add(category);
        }
        else if (category.IsDeleted)
        {
            category.IsDeleted = false;
        }

        var existingLinks = category.Id > 0
            ? await _context.Set<QuizCategory>()
                .Where(x => existingQuizIds.Contains(x.QuizId) && x.CategoryId == category.Id)
                .ToListAsync()
            : new List<QuizCategory>();

        var updated = 0;
        foreach (var quizId in existingQuizIds)
        {
            var existingLink = existingLinks.FirstOrDefault(x => x.QuizId == quizId);
            if (existingLink is not null)
            {
                if (existingLink.IsDeleted)
                {
                    existingLink.IsDeleted = false;
                    updated++;
                }

                continue;
            }

            _context.Set<QuizCategory>().Add(new QuizCategory
            {
                QuizId = quizId,
                Category = category,
                IsDeleted = false
            });

            updated++;
        }

        await _context.SaveChangesAsync();
        return updated;
    }

    public async Task<int> RemoveCategoryFromQuizzesAsync(IEnumerable<int> quizIds, string categoryName)
    {
        var ids = (quizIds ?? Enumerable.Empty<int>())
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        var normalizedCategory = NormalizeCategoryName(categoryName);
        if (ids.Count == 0 || string.IsNullOrWhiteSpace(normalizedCategory.Name))
        {
            return 0;
        }

        var category = await _context.Set<Category>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.NormalizedName == normalizedCategory.NormalizedName && !x.IsDeleted);

        if (category is null)
        {
            return 0;
        }

        var linksToRemove = await _context.Set<QuizCategory>()
            .Where(x => ids.Contains(x.QuizId) && x.CategoryId == category.Id && !x.IsDeleted)
            .ToListAsync();

        if (linksToRemove.Count == 0)
        {
            return 0;
        }

        _context.Set<QuizCategory>().RemoveRange(linksToRemove);
        await _context.SaveChangesAsync();
        return linksToRemove.Count;
    }

    private QuizResponseDto MapQuizDetails(Quiz quiz)
    {
        var dto = new QuizResponseDto
        {
            Id = quiz.Id,
            Title = quiz.Title,
            Description = quiz.Description,
            CoverImageUrl = GetImageUrl(quiz.Id, "quizzes", "quiz"),
            Mode = quiz.Mode,
            DurationMinutes = quiz.DurationMinutes,
            TotalMarks = quiz.TotalMarks,
            EffectiveTotalMarks = ComputeEffectiveTotalMarks(quiz),
            IsPublished = quiz.IsPublished,
            CreatedBy = quiz.CreatedBy,
            CreatedAt = quiz.CreatedAt,
            QuestionsCount = quiz.QuizQuestions.Count(x => !x.IsDeleted),
            Categories = MapCategories(quiz),
            Questions = quiz.QuizQuestions
                .Where(x => !x.IsDeleted)
                .OrderBy(x => x.Order)
                .Select(x => new QuizQuestionResponseDto
                {
                    Id = x.Id,
                    QuestionId = x.QuestionId,
                    QuestionTitle = x.Question.Title,
                    Order = x.Order,
                    PointsOverride = x.PointsOverride,
                    AnswerSeconds = x.AnswerSeconds,
                    Question = MapAdminQuestion(x.Question, x.PointsOverride, x.AnswerSeconds)
                })
                .ToList()
        };
        ApplyQuizAccessToDto(quiz, dto);
        return dto;
    }

    private QuizResponseDto MapQuizSummary(Quiz quiz)
    {
        var dto = new QuizResponseDto
        {
            Id = quiz.Id,
            Title = quiz.Title,
            Description = quiz.Description,
            CoverImageUrl = GetImageUrl(quiz.Id, "quizzes", "quiz"),
            Mode = quiz.Mode,
            DurationMinutes = quiz.DurationMinutes,
            TotalMarks = quiz.TotalMarks,
            EffectiveTotalMarks = ComputeEffectiveTotalMarks(quiz),
            IsPublished = quiz.IsPublished,
            CreatedBy = quiz.CreatedBy,
            CreatedAt = quiz.CreatedAt,
            QuestionsCount = quiz.QuizQuestions.Count(q => !q.IsDeleted),
            Categories = MapCategories(quiz)
        };
        ApplyQuizAccessToDto(quiz, dto);
        return dto;
    }

    private static void ApplyQuizAccessToDto(Quiz quiz, QuizResponseDto dto)
    {
        var access = quiz.QuizAccess;
        if (access is not { IsDeleted: false })
        {
            return;
        }

        dto.ExamMode = (int)access.ExamMode;
        dto.AccessType = (int)access.AccessType;
    }

    private static List<QuizCategoryDto> MapCategories(Quiz quiz)
    {
        return quiz.QuizCategories
            .Where(x => !x.IsDeleted && !x.Category.IsDeleted)
            .OrderBy(x => x.Category.Name)
            .Select(x => new QuizCategoryDto
            {
                Id = x.CategoryId,
                Name = x.Category.Name
            })
            .ToList();
    }

    private QuestionResponseDto MapAdminQuestion(Question question, int? pointsOverride = null, int? answerSecondsOverride = null)
    {
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

        return new QuestionResponseDto
        {
            Id = question.Id,
            Title = question.Title,
            Text = question.Text,
            Type = question.Type,
            SelectionMode = question.SelectionMode,
            Difficulty = question.Difficulty,
            ImageUrl = GetImageUrl(question.Id, "questions", "question"),
            Explanation = question.Explanation,
            Points = pointsOverride ?? question.Points,
            AnswerSeconds = answerSecondsOverride ?? question.AnswerSeconds,
            CreatedBy = question.CreatedBy,
            CreatedAt = question.CreatedAt,
            CategoryId = primaryCategoryId,
            CategoryName = primaryCategoryName,
            Categories = categories,
            Choices = question.Choices
                .Where(c => !c.IsDeleted)
                .OrderBy(c => c.Order)
                .Select(c =>
                {
                    var choiceImageUrl = GetImageUrl(c.Id, "question-choices", "choice");
                    return new QuestionChoiceDto
                    {
                        Id = c.Id,
                        ChoiceText = c.ChoiceText,
                        ImageUrl = choiceImageUrl,
                        HasImage = !string.IsNullOrWhiteSpace(choiceImageUrl),
                        IsCorrect = c.IsCorrect,
                        Order = c.Order
                    };
                })
                .ToList()
        };
    }

    private async Task SyncCategoriesAsync(int quizId, IEnumerable<string>? rawCategories)
    {
        var desiredNames = (rawCategories ?? Enumerable.Empty<string>())
            .Select(x => NormalizeCategoryName(x))
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .GroupBy(x => x.NormalizedName)
            .Select(g => g.First())
            .ToList();

        var existingLinks = await _context.Set<QuizCategory>()
            .Include(x => x.Category)
            .Where(x => x.QuizId == quizId)
            .ToListAsync();

        var desiredNormalizedNames = desiredNames
            .Select(x => x.NormalizedName)
            .ToHashSet(StringComparer.Ordinal);

        var linksToRemove = existingLinks
            .Where(x => !desiredNormalizedNames.Contains(x.Category.NormalizedName))
            .ToList();

        if (linksToRemove.Count > 0)
        {
            _context.Set<QuizCategory>().RemoveRange(linksToRemove);
        }

        if (desiredNames.Count == 0)
        {
            return;
        }

        var desiredLookup = desiredNames.ToDictionary(x => x.NormalizedName, x => x.Name, StringComparer.Ordinal);
        var existingCategories = await _context.Set<Category>()
            .Where(x => desiredNormalizedNames.Contains(x.NormalizedName))
            .ToListAsync();

        foreach (var normalizedName in desiredNormalizedNames)
        {
            if (existingCategories.Any(x => x.NormalizedName == normalizedName))
            {
                continue;
            }

            var category = new Category
            {
                Name = desiredLookup[normalizedName],
                NormalizedName = normalizedName,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
            existingCategories.Add(category);
            _context.Set<Category>().Add(category);
        }

        foreach (var category in existingCategories)
        {
            var alreadyLinked = existingLinks.Any(x => x.CategoryId == category.Id);
            if (alreadyLinked)
            {
                continue;
            }

            _context.Set<QuizCategory>().Add(new QuizCategory
            {
                QuizId = quizId,
                Category = category,
                IsDeleted = false
            });
        }
    }

    private static (string Name, string NormalizedName) NormalizeCategoryName(string? value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        return (trimmed, trimmed.ToUpperInvariant());
    }

    private static void ValidateQuiz(QuizCreateUpdateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            throw new ArgumentException("Quiz title is required.");
        }
    }

    private static int NormalizeDurationMinutes(int value)
    {
        if (value < 0)
        {
            return 0;
        }

        if (value > 1440)
        {
            return 1440;
        }

        return value;
    }

    private static int? NormalizeTotalMarks(int? value)
    {
        if (!value.HasValue || value.Value <= 0)
        {
            return null;
        }

        return value.Value;
    }

    private static int ComputeEffectiveTotalMarks(Quiz quiz)
    {
        return quiz.QuizQuestions
            .Where(x => !x.IsDeleted && !x.Question.IsDeleted)
            .Sum(x => x.PointsOverride ?? x.Question.Points);
    }

    private static int NormalizeAnswerSeconds(int? rawValue)
    {
        var value = rawValue ?? 30;
        if (value < 5) return 5;
        if (value > 300) return 300;
        return value;
    }

    private static void ValidateImageFile(IFormFile file)
    {
        if (file.Length <= 0)
        {
            throw new ArgumentException("Image file is empty.");
        }

        if (file.Length > MaxCoverSizeBytes)
        {
            throw new ArgumentException("Image size must be 5 MB or less.");
        }

        var extension = Path.GetExtension(file.FileName)?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension) || !AllowedImageExtensions.Contains(extension))
        {
            throw new ArgumentException("Only JPG, JPEG, PNG, or WEBP images are allowed.");
        }
    }

    private string GetImageUrl(int entityId, string folderName, string filePrefix)
    {
        var uploadsDirectory = GetImageDirectoryPath(folderName);
        if (!Directory.Exists(uploadsDirectory))
        {
            return string.Empty;
        }

        var filePath = Directory
            .EnumerateFiles(uploadsDirectory, $"{filePrefix}-{entityId}.*", SearchOption.TopDirectoryOnly)
            .FirstOrDefault(path => AllowedImageExtensions.Contains(Path.GetExtension(path)));

        if (string.IsNullOrWhiteSpace(filePath))
        {
            return string.Empty;
        }

        var fileName = Path.GetFileName(filePath);
        var relativePath = $"/uploads/{folderName}/{fileName}";
        return AddVersion(relativePath, File.GetLastWriteTimeUtc(filePath));
    }

    private string EnsureImageDirectory(string folderName)
    {
        var path = GetImageDirectoryPath(folderName);
        Directory.CreateDirectory(path);
        return path;
    }

    private string GetImageDirectoryPath(string folderName)
    {
        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        }

        return Path.Combine(webRoot, "uploads", folderName);
    }

    private static string AddVersion(string relativePath, DateTime lastWriteUtc)
    {
        var version = new DateTimeOffset(lastWriteUtc).ToUnixTimeSeconds();
        return $"{relativePath}?v={version}";
    }

    private static void DeleteExistingImages(int entityId, string uploadsDirectory, string filePrefix)
    {
        foreach (var path in Directory.EnumerateFiles(uploadsDirectory, $"{filePrefix}-{entityId}.*", SearchOption.TopDirectoryOnly))
        {
            var extension = Path.GetExtension(path);
            if (!AllowedImageExtensions.Contains(extension))
            {
                continue;
            }

            File.Delete(path);
        }
    }
}
