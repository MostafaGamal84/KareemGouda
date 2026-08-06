using API.Data;
using API.DTOs.QuizGame;
using API.Entities.QuizGame;
using API.Interfaces.QuizGame;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace API.Services.QuizGame;

public class QuestionService : IQuestionService
{
    private static readonly Regex HtmlTagRegex = new(@"<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex WhitespaceRegex = new(@"\s+", RegexOptions.Compiled);
    private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };
    private const long MaxImageSizeBytes = 5 * 1024 * 1024;

    private readonly DataContext _context;
    private readonly IWebHostEnvironment _environment;

    public QuestionService(DataContext context, IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    public async Task<QuestionResponseDto> CreateAsync(QuestionCreateUpdateDto dto, int? userId)
    {
        ValidateQuestion(dto);
        var categoryIds = await ResolveExistingCategoryIdsAsync(dto);

        var question = new Question
        {
            Title = dto.Title.Trim(),
            Text = dto.Text.Trim(),
            Type = dto.Type,
            SelectionMode = NormalizeSelectionMode(dto),
            Difficulty = string.IsNullOrWhiteSpace(dto.Difficulty) ? null : dto.Difficulty.Trim(),
            Explanation = string.IsNullOrWhiteSpace(dto.Explanation) ? null : dto.Explanation.Trim(),
            Points = dto.Points,
            AnswerSeconds = NormalizeAnswerSeconds(dto.AnswerSeconds),
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
            CategoryId = categoryIds.Count > 0 ? categoryIds[0] : null,
            QuizId = dto.QuizId,
            IsDeleted = false,
            QuestionCategoryAssignments = categoryIds
                .Select(categoryId => new QuestionCategoryAssignment
                {
                    CategoryId = categoryId,
                    IsDeleted = false
                })
                .ToList(),
            Choices = dto.Choices.Select(c => new QuestionChoice
            {
                ChoiceText = c.ChoiceText.Trim(),
                IsCorrect = c.IsCorrect,
                Order = c.Order
            }).ToList()
        };

        _context.Set<Question>().Add(question);
        await _context.SaveChangesAsync();

        if (dto.QuizId.HasValue)
        {
            var maxOrder = await _context.QuizQuestions
                .Where(xq => xq.QuizId == dto.QuizId.Value && !xq.IsDeleted)
                .Select(xq => (int?)xq.Order)
                .MaxAsync() ?? 0;

            _context.QuizQuestions.Add(new QuizQuestion
            {
                QuizId = dto.QuizId.Value,
                QuestionId = question.Id,
                Order = maxOrder + 1,
                PointsOverride = null,
                AnswerSeconds = dto.AnswerSeconds
            });

            await _context.SaveChangesAsync();
        }

        return await GetByIdAsync(question.Id) ?? ToQuestionResponse(question);
    }

    public async Task<QuestionResponseDto?> UpdateAsync(int id, QuestionCreateUpdateDto dto)
    {
        ValidateQuestion(dto);
        var categoryIds = await ResolveExistingCategoryIdsAsync(dto);

        var question = await _context.Set<Question>()
            .Include(x => x.Choices)
            .Include(x => x.QuestionCategoryAssignments)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (question is null)
        {
            return null;
        }

        question.Title = dto.Title.Trim();
        question.Text = dto.Text.Trim();
        question.Type = dto.Type;
        question.SelectionMode = NormalizeSelectionMode(dto);
        question.Difficulty = string.IsNullOrWhiteSpace(dto.Difficulty) ? null : dto.Difficulty.Trim();
        question.Explanation = string.IsNullOrWhiteSpace(dto.Explanation) ? null : dto.Explanation.Trim();
        question.Points = dto.Points;
        question.AnswerSeconds = NormalizeAnswerSeconds(dto.AnswerSeconds);
        question.CategoryId = categoryIds.Count > 0 ? categoryIds[0] : null;

        var incomingCategoryIds = categoryIds.ToHashSet();
        var existingAssignments = question.QuestionCategoryAssignments.ToDictionary(x => x.CategoryId);

        var assignmentsToRemove = question.QuestionCategoryAssignments
            .Where(x => !incomingCategoryIds.Contains(x.CategoryId))
            .ToList();

        if (assignmentsToRemove.Count > 0)
        {
            _context.Set<QuestionCategoryAssignment>().RemoveRange(assignmentsToRemove);
        }

        foreach (var categoryId in categoryIds)
        {
            if (existingAssignments.ContainsKey(categoryId))
            {
                continue;
            }

            question.QuestionCategoryAssignments.Add(new QuestionCategoryAssignment
            {
                QuestionId = question.Id,
                CategoryId = categoryId,
                IsDeleted = false
            });
        }

        var existingChoices = question.Choices
            .Where(c => !c.IsDeleted)
            .ToDictionary(c => c.Id);

        var incomingIds = dto.Choices
            .Where(c => c.Id > 0)
            .Select(c => c.Id)
            .ToHashSet();

        if (incomingIds.Any(idValue => !existingChoices.ContainsKey(idValue)))
        {
            throw new ArgumentException("One or more choices are invalid for this question.");
        }

        var choicesToRemove = existingChoices.Values
            .Where(choice => !incomingIds.Contains(choice.Id))
            .ToList();

        foreach (var choice in choicesToRemove)
        {
            DeleteExistingImages(choice.Id, EnsureImageDirectory("question-choices"), "choice");
            _context.Set<QuestionChoice>().Remove(choice);
        }

        foreach (var dtoChoice in dto.Choices)
        {
            if (dtoChoice.Id > 0 && existingChoices.TryGetValue(dtoChoice.Id, out var existingChoice))
            {
                existingChoice.ChoiceText = dtoChoice.ChoiceText.Trim();
                existingChoice.IsCorrect = dtoChoice.IsCorrect;
                existingChoice.Order = dtoChoice.Order;
                continue;
            }

            question.Choices.Add(new QuestionChoice
            {
                QuestionId = question.Id,
                ChoiceText = dtoChoice.ChoiceText.Trim(),
                IsCorrect = dtoChoice.IsCorrect,
                Order = dtoChoice.Order
            });
        }

        await _context.SaveChangesAsync();

        var updatedQuestion = await _context.Set<Question>()
            .AsNoTracking()
            .Include(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.QuestionCategoryAssignments)
            .ThenInclude(x => x.Category)
            .Include(x => x.Category)
            .Include(x => x.Quiz)
            .FirstOrDefaultAsync(x => x.Id == question.Id && !x.IsDeleted);

        return updatedQuestion is null
            ? ToQuestionResponse(question)
            : ToQuestionResponse(updatedQuestion);
    }

    public async Task<bool> SoftDeleteAsync(int id)
    {
        var question = await _context.Set<Question>().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
        if (question is null)
        {
            return false;
        }

        question.IsDeleted = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<QuestionResponseDto?> GetByIdAsync(int id)
    {
        var question = await _context.Set<Question>()
            .AsNoTracking()
            .Include(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.QuestionCategoryAssignments)
            .ThenInclude(x => x.Category)
            .Include(x => x.Category)
            .Include(x => x.Quiz)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        return question is null ? null : ToQuestionResponse(question);
    }

    public async Task<PagedResultDto<QuestionResponseDto>> GetAllAsync(QuestionQueryDto query)
    {
        var normalizedPage = query.PageNumber <= 0 ? 1 : query.PageNumber;
        var normalizedSize = query.PageSize <= 0 ? 10 : query.PageSize;

        var dbQuery = _context.Set<Question>()
            .AsNoTracking()
            .Include(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.QuestionCategoryAssignments)
            .ThenInclude(x => x.Category)
            .Include(x => x.Category)
            .Include(x => x.Quiz)
            .Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            dbQuery = dbQuery.Where(x =>
                x.Title.ToLower().Contains(search) ||
                x.Text.ToLower().Contains(search) ||
                (x.Explanation != null && x.Explanation.ToLower().Contains(search)) ||
                x.Choices.Any(choice => !choice.IsDeleted && choice.ChoiceText.ToLower().Contains(search)) ||
                x.QuestionCategoryAssignments.Any(link =>
                    !link.IsDeleted &&
                    link.Category != null &&
                    !link.Category.IsDeleted &&
                    link.Category.Name.ToLower().Contains(search)) ||
                (x.Category != null && !x.Category.IsDeleted && x.Category.Name.ToLower().Contains(search)));
        }

        if (query.Type.HasValue)
        {
            dbQuery = dbQuery.Where(x => x.Type == query.Type.Value);
        }

        if (query.SelectionMode.HasValue)
        {
            dbQuery = dbQuery.Where(x => x.SelectionMode == query.SelectionMode.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Difficulty))
        {
            var difficulty = query.Difficulty.Trim().ToLower();
            dbQuery = dbQuery.Where(x => x.Difficulty != null && x.Difficulty.ToLower() == difficulty);
        }

        if (query.CategoryId.HasValue)
        {
            dbQuery = dbQuery.Where(x => x.QuestionCategoryAssignments.Any(link => !link.IsDeleted && link.CategoryId == query.CategoryId.Value));
        }

        var total = await dbQuery.CountAsync();
        var items = await dbQuery
            .OrderByDescending(x => x.CreatedAt)
            .Skip((normalizedPage - 1) * normalizedSize)
            .Take(normalizedSize)
            .ToListAsync();

        return new PagedResultDto<QuestionResponseDto>
        {
            PageNumber = normalizedPage,
            PageSize = normalizedSize,
            TotalCount = total,
            Items = items.Select(ToQuestionResponse)
        };
    }

    public async Task<string?> UploadImageAsync(int questionId, IFormFile file)
    {
        var exists = await _context.Set<Question>()
            .AsNoTracking()
            .AnyAsync(x => x.Id == questionId && !x.IsDeleted);

        if (!exists)
        {
            return null;
        }

        ValidateImageFile(file);

        var uploadsDirectory = EnsureImageDirectory("questions");
        DeleteExistingImages(questionId, uploadsDirectory, "question");

        var extension = Path.GetExtension(file.FileName)?.Trim().ToLowerInvariant() ?? ".png";
        var fileName = $"question-{questionId}{extension}";
        var fullPath = Path.Combine(uploadsDirectory, fileName);

        await using (var stream = File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        var relativePath = $"/uploads/questions/{fileName}";
        return AddVersion(relativePath, File.GetLastWriteTimeUtc(fullPath));
    }

    public async Task<string?> UploadChoiceImageAsync(int questionId, int choiceId, IFormFile file)
    {
        var exists = await _context.Set<QuestionChoice>()
            .AsNoTracking()
            .AnyAsync(x => x.Id == choiceId && x.QuestionId == questionId && !x.IsDeleted && !x.Question.IsDeleted);

        if (!exists)
        {
            return null;
        }

        ValidateImageFile(file);

        var uploadsDirectory = EnsureImageDirectory("question-choices");
        DeleteExistingImages(choiceId, uploadsDirectory, "choice");

        var extension = Path.GetExtension(file.FileName)?.Trim().ToLowerInvariant() ?? ".png";
        var fileName = $"choice-{choiceId}{extension}";
        var fullPath = Path.Combine(uploadsDirectory, fileName);

        await using (var stream = File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        var relativePath = $"/uploads/question-choices/{fileName}";
        return AddVersion(relativePath, File.GetLastWriteTimeUtc(fullPath));
    }

    private QuestionResponseDto ToQuestionResponse(Question question)
    {
        var categories = question.QuestionCategoryAssignments
            .Where(link => !link.IsDeleted && link.Category is not null && !link.Category.IsDeleted)
            .OrderBy(link => link.Category!.Name)
            .Select(link => new QuestionCategoryRefDto
            {
                Id = link.CategoryId,
                Name = link.Category!.Name
            })
            .ToList();

        var primaryCategoryId = question.CategoryId.HasValue && question.CategoryId.Value > 0
            ? question.CategoryId
            : categories.FirstOrDefault()?.Id;
        var primaryCategoryName = categories.FirstOrDefault(category => category.Id == primaryCategoryId)?.Name
            ?? categories.FirstOrDefault()?.Name
            ?? question.Category?.Name;

        return new QuestionResponseDto
        {
            Id = question.Id,
            Title = question.Title,
            Text = question.Text,
            Type = question.Type,
            SelectionMode = question.SelectionMode,
            Difficulty = question.Difficulty,
            ImageUrl = GetQuestionImageUrl(question.Id),
            Explanation = question.Explanation,
            Points = question.Points,
            AnswerSeconds = question.AnswerSeconds,
            CreatedBy = question.CreatedBy,
            CreatedAt = question.CreatedAt,
            CategoryId = primaryCategoryId,
            CategoryName = primaryCategoryName,
            Categories = categories,
            QuizId = question.QuizId,
            QuizTitle = question.Quiz?.Title,
            Choices = question.Choices
                .Where(c => !c.IsDeleted)
                .OrderBy(c => c.Order)
                .Select(ToChoiceDto)
                .ToList()
        };
    }

    private static void ValidateQuestion(QuestionCreateUpdateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            throw new ArgumentException("Question title is required.");
        }

        if (string.IsNullOrWhiteSpace(ExtractPlainText(dto.Text)))
        {
            throw new ArgumentException("Question text is required.");
        }

        if (dto.Points <= 0)
        {
            throw new ArgumentException("Points must be greater than 0.");
        }

        if (dto.AnswerSeconds != 0 && (dto.AnswerSeconds < 5 || dto.AnswerSeconds > 300))
        {
            throw new ArgumentException("Answer time must be 0 (unlimited) or between 5 and 300 seconds.");
        }

        foreach (var choice in dto.Choices)
        {
            if (string.IsNullOrWhiteSpace(choice.ChoiceText) && !choice.HasImage)
            {
                throw new ArgumentException("Each choice must include text or an image.");
            }
        }

        if (dto.Type == QuestionType.MultipleChoice || dto.Type == QuestionType.TrueFalse)
        {
            if (dto.Choices.Count < 2)
            {
                throw new ArgumentException("At least 2 choices are required for this question type.");
            }

            var correctChoices = dto.Choices.Count(c => c.IsCorrect);
            if (correctChoices == 0)
            {
                throw new ArgumentException("At least one correct choice is required.");
            }

            var requiresSingleAnswer = dto.Type == QuestionType.TrueFalse || dto.SelectionMode != QuestionSelectionMode.Multiple;
            if (requiresSingleAnswer && correctChoices != 1)
            {
                throw new ArgumentException("Single-answer questions must have exactly one correct choice.");
            }
        }

        if (dto.Type == QuestionType.ShortAnswer)
        {
            if (dto.Choices.Count != 1)
            {
                throw new ArgumentException("Short answer requires exactly one answer key.");
            }

            if (string.IsNullOrWhiteSpace(dto.Choices[0].ChoiceText))
            {
                throw new ArgumentException("Short answer key cannot be empty.");
            }

            if (!dto.Choices[0].IsCorrect)
            {
                throw new ArgumentException("Short answer key must be marked as correct.");
            }
        }
    }

    private static QuestionSelectionMode NormalizeSelectionMode(QuestionCreateUpdateDto dto)
    {
        if (dto.Type != QuestionType.MultipleChoice)
        {
            return QuestionSelectionMode.Single;
        }

        return dto.SelectionMode == QuestionSelectionMode.Multiple
            ? QuestionSelectionMode.Multiple
            : QuestionSelectionMode.Single;
    }

    private static int NormalizeAnswerSeconds(int value)
    {
        if (value < 5) return 5;
        if (value > 300) return 300;
        return value;
    }

    private static string ExtractPlainText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var withoutTags = HtmlTagRegex.Replace(value, " ");
        withoutTags = withoutTags
            .Replace("&nbsp;", " ", StringComparison.OrdinalIgnoreCase)
            .Replace("&#160;", " ", StringComparison.OrdinalIgnoreCase);

        return WhitespaceRegex.Replace(withoutTags, " ").Trim();
    }

    private static void ValidateImageFile(IFormFile file)
    {
        if (file.Length <= 0)
        {
            throw new ArgumentException("Image file is empty.");
        }

        if (file.Length > MaxImageSizeBytes)
        {
            throw new ArgumentException("Image size must be 5 MB or less.");
        }

        var extension = Path.GetExtension(file.FileName)?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension) || !AllowedImageExtensions.Contains(extension))
        {
            throw new ArgumentException("Only JPG, JPEG, PNG, or WEBP images are allowed.");
        }
    }

    private QuestionChoiceDto ToChoiceDto(QuestionChoice choice)
    {
        var imageUrl = GetChoiceImageUrl(choice.Id);
        return new QuestionChoiceDto
        {
            Id = choice.Id,
            ChoiceText = choice.ChoiceText,
            ImageUrl = imageUrl,
            HasImage = !string.IsNullOrWhiteSpace(imageUrl),
            IsCorrect = choice.IsCorrect,
            Order = choice.Order
        };
    }

    private string GetQuestionImageUrl(int questionId)
    {
        return GetImageUrl(questionId, "questions", "question");
    }

    private string GetChoiceImageUrl(int choiceId)
    {
        return GetImageUrl(choiceId, "question-choices", "choice");
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

    public async Task<List<RandomQuestionResultDto>> GetRandomQuestionsByCategoryAsync(RandomQuestionSelectionRequest request)
    {
        var results = new List<RandomQuestionResultDto>();

        foreach (var selection in request.CategorySelections)
        {
            var category = await _context.Set<QuestionCategory>()
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == selection.CategoryId);

            if (category == null) continue;

            var allQuestions = await _context.Set<Question>()
                .AsNoTracking()
                .Include(x => x.Choices.Where(c => !c.IsDeleted))
                .Include(x => x.QuestionCategoryAssignments)
                .ThenInclude(x => x.Category)
                .Where(x => !x.IsDeleted && x.QuestionCategoryAssignments.Any(link => link.CategoryId == selection.CategoryId))
                .ToListAsync();

            var shuffled = allQuestions.OrderBy(_ => Guid.NewGuid()).Take(selection.Count).ToList();
            var availableCount = allQuestions.Count;

            results.Add(new RandomQuestionResultDto
            {
                CategoryId = selection.CategoryId,
                CategoryName = category.Name,
                RequestedCount = selection.Count,
                AvailableCount = availableCount,
                Questions = shuffled.Select(ToQuestionResponse).ToList()
            });
        }

        return results;
    }

    public async Task<List<QuestionCategory>> GetCategoriesWithQuestionCountsAsync()
    {
        return await _context.Set<QuestionCategory>()
            .AsNoTracking()
            .Include(c => c.QuestionCategoryAssignments.Where(link => !link.IsDeleted))
            .ThenInclude(link => link.Question)
            .OrderBy(c => c.Name)
            .ToListAsync();
    }

    public async Task<QuestionResponseDto?> DuplicateAsync(int questionId, int userId)
    {
        var original = await _context.Set<Question>()
            .Include(x => x.Choices.Where(c => !c.IsDeleted))
            .Include(x => x.QuestionCategoryAssignments)
            .FirstOrDefaultAsync(x => x.Id == questionId && !x.IsDeleted);

        if (original is null)
        {
            return null;
        }

        var newQuestion = new Question
        {
            Title = $"{original.Title} (Copy)",
            Text = original.Text,
            Type = original.Type,
            SelectionMode = original.SelectionMode,
            Difficulty = original.Difficulty,
            Explanation = original.Explanation,
            Points = original.Points,
            AnswerSeconds = original.AnswerSeconds,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false,
            CategoryId = original.CategoryId,
            QuestionCategoryAssignments = original.QuestionCategoryAssignments
                .Select(link => new QuestionCategoryAssignment
                {
                    CategoryId = link.CategoryId,
                    IsDeleted = false
                })
                .ToList(),
            QuizId = original.QuizId
        };

        foreach (var choice in original.Choices.OrderBy(c => c.Order))
        {
            newQuestion.Choices.Add(new QuestionChoice
            {
                ChoiceText = choice.ChoiceText,
                IsCorrect = choice.IsCorrect,
                Order = choice.Order,
                IsDeleted = false
            });
        }

        _context.Set<Question>().Add(newQuestion);
        await _context.SaveChangesAsync();

        return await GetByIdAsync(newQuestion.Id);
    }

    public async Task<int> AddCategoryToQuestionsAsync(IEnumerable<int> questionIds, string categoryName)
    {
        var ids = (questionIds ?? Enumerable.Empty<int>())
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        var normalizedCategory = NormalizeCategoryName(categoryName);
        if (ids.Count == 0 || string.IsNullOrWhiteSpace(normalizedCategory.Name))
        {
            return 0;
        }

        var category = await _context.Set<QuestionCategory>()
            .FirstOrDefaultAsync(x => x.Name.ToUpper() == normalizedCategory.NormalizedName);

        var shouldSaveCategory = false;
        if (category is null)
        {
            category = new QuestionCategory
            {
                Name = normalizedCategory.Name,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _context.Set<QuestionCategory>().Add(category);
            shouldSaveCategory = true;
        }
        else
        {
            if (category.IsDeleted)
            {
                category.IsDeleted = false;
                shouldSaveCategory = true;
            }

            if (!string.Equals(category.Name, normalizedCategory.Name, StringComparison.Ordinal))
            {
                category.Name = normalizedCategory.Name;
                shouldSaveCategory = true;
            }
        }

        if (shouldSaveCategory)
        {
            await _context.SaveChangesAsync();
        }

        var questionsToUpdate = await _context.Set<Question>()
            .Include(x => x.QuestionCategoryAssignments)
            .Where(x => ids.Contains(x.Id) && !x.IsDeleted)
            .ToListAsync();

        var updatedQuestionIds = new HashSet<int>();
        foreach (var question in questionsToUpdate)
        {
            if (question.QuestionCategoryAssignments.Any(link => link.CategoryId == category.Id))
            {
                continue;
            }

            question.QuestionCategoryAssignments.Add(new QuestionCategoryAssignment
            {
                QuestionId = question.Id,
                CategoryId = category.Id,
                IsDeleted = false
            });

            if (!question.CategoryId.HasValue || question.CategoryId <= 0)
            {
                question.CategoryId = category.Id;
            }

            updatedQuestionIds.Add(question.Id);
        }

        if (updatedQuestionIds.Count > 0)
        {
            await _context.SaveChangesAsync();
        }

        return updatedQuestionIds.Count;
    }

    public async Task<int> RemoveCategoryFromQuestionsAsync(IEnumerable<int> questionIds, string? categoryName = null)
    {
        var ids = (questionIds ?? Enumerable.Empty<int>())
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return 0;
        }

        var questionsToUpdate = await _context.Set<Question>()
            .Include(x => x.QuestionCategoryAssignments)
            .Where(x => ids.Contains(x.Id) && !x.IsDeleted)
            .ToListAsync();

        if (questionsToUpdate.Count == 0)
        {
            return 0;
        }

        int? targetCategoryId = null;
        if (!string.IsNullOrWhiteSpace(categoryName))
        {
            var normalizedCategory = NormalizeCategoryName(categoryName);
            var category = await _context.Set<QuestionCategory>()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Name.ToUpper() == normalizedCategory.NormalizedName);

            if (category is null)
            {
                return 0;
            }

            targetCategoryId = category.Id;
        }

        var changedQuestionIds = new HashSet<int>();
        var assignmentsToRemove = new List<QuestionCategoryAssignment>();

        foreach (var question in questionsToUpdate)
        {
            var removableAssignments = targetCategoryId.HasValue
                ? question.QuestionCategoryAssignments.Where(link => link.CategoryId == targetCategoryId.Value).ToList()
                : question.QuestionCategoryAssignments.ToList();

            if (removableAssignments.Count == 0)
            {
                continue;
            }

            assignmentsToRemove.AddRange(removableAssignments);
            changedQuestionIds.Add(question.Id);

            var remainingCategoryId = question.QuestionCategoryAssignments
                .Where(link => !removableAssignments.Contains(link))
                .Select(link => (int?)link.CategoryId)
                .OrderBy(linkCategoryId => linkCategoryId)
                .FirstOrDefault();

            question.CategoryId = remainingCategoryId;
        }

        if (assignmentsToRemove.Count > 0)
        {
            _context.Set<QuestionCategoryAssignment>().RemoveRange(assignmentsToRemove);
            await _context.SaveChangesAsync();
        }

        return changedQuestionIds.Count;
    }

    public async Task<int> UpdateSettingsAsync(IEnumerable<int> questionIds, int? points, int? answerSeconds)
    {
        var ids = questionIds.Where(id => id > 0).Distinct().ToList();
        if (ids.Count == 0)
        {
            return 0;
        }

        if (points.HasValue && points.Value <= 0)
        {
            throw new ArgumentException("Points must be greater than 0.");
        }

        if (answerSeconds.HasValue &&
            answerSeconds.Value != 0 &&
            (answerSeconds.Value < 5 || answerSeconds.Value > 300))
        {
            throw new ArgumentException("Answer time must be 0 (unlimited) or between 5 and 300 seconds.");
        }

        var questions = await _context.Set<Question>()
            .Where(question => ids.Contains(question.Id) && !question.IsDeleted)
            .ToListAsync();

        foreach (var question in questions)
        {
            if (points.HasValue)
            {
                question.Points = points.Value;
            }

            if (answerSeconds.HasValue)
            {
                question.AnswerSeconds = answerSeconds.Value;
            }
        }

        await _context.SaveChangesAsync();
        return questions.Count;
    }

    public async Task<int> ImportFromExcelAsync(IFormFile file)
    {
        var questions = new List<Question>();
        var categories = await _context.Set<QuestionCategory>().ToListAsync();

        using var stream = file.OpenReadStream();
        using var workbook = new ClosedXML.Excel.XLWorkbook(stream);
        var worksheet = workbook.Worksheet(1);
        var explanationColumn = GetColumnIndexByHeader(worksheet, "Explanation");
        var answerSecondsColumn = GetColumnIndexByHeader(worksheet, "Answer Seconds");
        var selectionModeColumn = GetColumnIndexByHeader(worksheet, "Selection Mode");
        var choiceEColumn = GetColumnIndexByHeader(worksheet, "Choice E");
        var rows = worksheet.RowsUsed().Skip(1);

        foreach (var row in rows)
        {
            var title = row.Cell(1).GetString();
            if (string.IsNullOrWhiteSpace(title)) continue;

            var categoryNames = row.Cell(2).GetString()
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var questionCategoryIds = new List<int>();
            foreach (var categoryName in categoryNames)
            {
                var category = categories.FirstOrDefault(c => c.Name.Equals(categoryName, StringComparison.OrdinalIgnoreCase));
                if (category is null)
                {
                    category = new QuestionCategory
                    {
                        Name = categoryName.Trim(),
                        CreatedAt = DateTime.UtcNow,
                        IsDeleted = false
                    };
                    _context.Set<QuestionCategory>().Add(category);
                    categories.Add(category);
                    await _context.SaveChangesAsync();
                }

                questionCategoryIds.Add(category.Id);
            }

            var question = new Question
            {
                Title = title,
                Text = row.Cell(3).GetString(),
                Type = (QuestionType)GetQuestionType(row.Cell(4).GetString()),
                SelectionMode = ParseSelectionMode(selectionModeColumn.HasValue ? row.Cell(selectionModeColumn.Value).GetString() : null),
                Difficulty = NormalizeOptionalCellText(row.Cell(5)),
                Explanation = NormalizeOptionalCellText(explanationColumn.HasValue ? row.Cell(explanationColumn.Value) : null),
                Points = GetCellValueOrDefault(row.Cell(6), 1),
                AnswerSeconds = GetCellValueOrDefault(answerSecondsColumn.HasValue ? row.Cell(answerSecondsColumn.Value) : null, 30),
                CategoryId = questionCategoryIds.Count > 0 ? questionCategoryIds[0] : null,
                QuestionCategoryAssignments = questionCategoryIds
                    .Select(categoryId => new QuestionCategoryAssignment
                    {
                        CategoryId = categoryId,
                        IsDeleted = false
                    })
                    .ToList(),
                IsDeleted = false,
                CreatedAt = DateTime.UtcNow
            };

            var correctIndexes = row.Cell(7).GetString()
                .Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(value => value.ToUpperInvariant())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var choiceTexts = new List<string> {
                row.Cell(8).GetString(),
                row.Cell(9).GetString(),
                row.Cell(10).GetString(),
                row.Cell(11).GetString()
            };
            if (choiceEColumn.HasValue)
            {
                choiceTexts.Add(row.Cell(choiceEColumn.Value).GetString());
            }

            for (int i = 0; i < choiceTexts.Count; i++)
            {
                if (!string.IsNullOrWhiteSpace(choiceTexts[i]))
                {
                    question.Choices.Add(new QuestionChoice
                    {
                        ChoiceText = choiceTexts[i],
                        IsCorrect = correctIndexes.Contains(((char)('A' + i)).ToString()),
                        Order = i + 1,
                        IsDeleted = false
                    });
                }
            }

            if (question.Choices.Count == 0)
            {
                question.Type = QuestionType.ShortAnswer;
            }

            questions.Add(question);
        }

        _context.Set<Question>().AddRange(questions);
        await _context.SaveChangesAsync();

        return questions.Count;
    }

    private static int GetCellValueOrDefault(ClosedXML.Excel.IXLCell? cell, int defaultValue)
    {
        if (cell is null)
            return defaultValue;
        if (cell.Value.IsNumber)
            return (int)cell.Value.GetNumber();
        if (cell.Value.IsText && int.TryParse(cell.Value.GetText(), out int result))
            return result;
        return defaultValue;
    }

    private static QuestionSelectionMode ParseSelectionMode(string? value)
    {
        if (Enum.TryParse<QuestionSelectionMode>(value, true, out var parsed))
        {
            return parsed;
        }

        return string.Equals(value?.Trim(), "Multiple Answers", StringComparison.OrdinalIgnoreCase)
            ? QuestionSelectionMode.Multiple
            : QuestionSelectionMode.Single;
    }

    private static int? GetColumnIndexByHeader(ClosedXML.Excel.IXLWorksheet worksheet, string headerName)
    {
        var headerRow = worksheet.FirstRowUsed();
        if (headerRow is null)
        {
            return null;
        }

        foreach (var cell in headerRow.CellsUsed())
        {
            if (string.Equals(cell.GetString().Trim(), headerName, StringComparison.OrdinalIgnoreCase))
            {
                return cell.Address.ColumnNumber;
            }
        }

        return null;
    }

    private static string? NormalizeOptionalCellText(ClosedXML.Excel.IXLCell? cell)
    {
        if (cell is null)
        {
            return null;
        }

        var value = cell.GetString().Trim();
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    public async Task<Stream> ExportToExcelAsync(string? search = null, int? type = null, string? difficulty = null)
    {
        var query = _context.Set<Question>()
            .Include(q => q.Category)
            .Include(q => q.QuestionCategoryAssignments)
            .ThenInclude(link => link.Category)
            .Include(q => q.Choices.Where(c => !c.IsDeleted))
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(q => q.Title.Contains(search) || q.Text.Contains(search));
        }
        if (type.HasValue)
        {
            query = query.Where(q => q.Type == (QuestionType)type.Value);
        }
        if (!string.IsNullOrWhiteSpace(difficulty))
        {
            query = query.Where(q => q.Difficulty == difficulty);
        }

        var questions = await query.Where(q => !q.IsDeleted).OrderBy(q => q.Id).ToListAsync();

        using var workbook = new ClosedXML.Excel.XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Questions");

        worksheet.Cell(1, 1).Value = "Title";
        worksheet.Cell(1, 2).Value = "Category";
        worksheet.Cell(1, 3).Value = "Text";
        worksheet.Cell(1, 4).Value = "Type";
        worksheet.Cell(1, 5).Value = "Difficulty";
        worksheet.Cell(1, 6).Value = "Points";
        worksheet.Cell(1, 7).Value = "Correct Answer";
        worksheet.Cell(1, 8).Value = "Choice A";
        worksheet.Cell(1, 9).Value = "Choice B";
        worksheet.Cell(1, 10).Value = "Choice C";
        worksheet.Cell(1, 11).Value = "Choice D";
        worksheet.Cell(1, 12).Value = "Explanation";
        worksheet.Cell(1, 13).Value = "Answer Seconds";
        worksheet.Cell(1, 14).Value = "Selection Mode";
        worksheet.Cell(1, 15).Value = "Choice E";

        var headerRange = worksheet.Range(1, 1, 1, 15);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

        int row = 2;
        foreach (var q in questions)
        {
            worksheet.Cell(row, 1).Value = q.Title;
            worksheet.Cell(row, 2).Value = string.Join(", ", q.QuestionCategoryAssignments
                .Where(link => !link.IsDeleted && link.Category is not null && !link.Category.IsDeleted)
                .OrderBy(link => link.Category!.Name)
                .Select(link => link.Category!.Name));
            worksheet.Cell(row, 3).Value = q.Text;
            worksheet.Cell(row, 4).Value = GetTypeName(q.Type);
            worksheet.Cell(row, 5).Value = q.Difficulty ?? "";
            worksheet.Cell(row, 6).Value = q.Points;

            var correctAnswers = q.Choices
                .Where(choice => choice.IsCorrect)
                .OrderBy(choice => choice.Order)
                .Select(choice => GetChoiceLetter(choice.Order))
                .Where(value => !string.IsNullOrWhiteSpace(value));
            worksheet.Cell(row, 7).Value = string.Join(",", correctAnswers);

            var orderedChoices = q.Choices.OrderBy(c => c.Order).ToList();
            for (int i = 0; i < 4 && i < orderedChoices.Count; i++)
            {
                worksheet.Cell(row, 8 + i).Value = orderedChoices[i].ChoiceText;
            }

            worksheet.Cell(row, 12).Value = q.Explanation ?? "";
            worksheet.Cell(row, 13).Value = q.AnswerSeconds;
            worksheet.Cell(row, 14).Value = q.SelectionMode.ToString();
            worksheet.Cell(row, 15).Value = orderedChoices.Count > 4 ? orderedChoices[4].ChoiceText : "";

            row++;
        }

        worksheet.Columns().AdjustToContents();

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        return stream;
    }

    private static QuestionType GetQuestionType(string typeStr)
    {
        return typeStr.ToLower() switch
        {
            "multiple choice" or "mcq" => QuestionType.MultipleChoice,
            "true/false" or "tf" => QuestionType.TrueFalse,
            "short answer" => QuestionType.ShortAnswer,
            _ => QuestionType.MultipleChoice
        };
    }

    private static string GetTypeName(QuestionType type)
    {
        return type switch
        {
            QuestionType.MultipleChoice => "Multiple Choice",
            QuestionType.TrueFalse => "True/False",
            QuestionType.ShortAnswer => "Short Answer",
            _ => "Multiple Choice"
        };
    }

    private static string GetChoiceLetter(int order)
    {
        return order switch
        {
            1 => "A",
            2 => "B",
            3 => "C",
            4 => "D",
            5 => "E",
            _ => ""
        };
    }

    public async Task<Stream> ExportSelectedToExcelAsync(List<int> ids)
    {
        var questions = await _context.Set<Question>()
            .Include(q => q.Category)
            .Include(q => q.QuestionCategoryAssignments)
            .ThenInclude(link => link.Category)
            .Include(q => q.Choices.Where(c => !c.IsDeleted))
            .Where(q => !q.IsDeleted && ids.Contains(q.Id))
            .OrderBy(q => q.Id)
            .ToListAsync();

        using var workbook = new ClosedXML.Excel.XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Questions");

        worksheet.Cell(1, 1).Value = "Title";
        worksheet.Cell(1, 2).Value = "Category";
        worksheet.Cell(1, 3).Value = "Text";
        worksheet.Cell(1, 4).Value = "Type";
        worksheet.Cell(1, 5).Value = "Difficulty";
        worksheet.Cell(1, 6).Value = "Points";
        worksheet.Cell(1, 7).Value = "Correct Answer";
        worksheet.Cell(1, 8).Value = "Choice A";
        worksheet.Cell(1, 9).Value = "Choice B";
        worksheet.Cell(1, 10).Value = "Choice C";
        worksheet.Cell(1, 11).Value = "Choice D";
        worksheet.Cell(1, 12).Value = "Explanation";
        worksheet.Cell(1, 13).Value = "Answer Seconds";
        worksheet.Cell(1, 14).Value = "Selection Mode";
        worksheet.Cell(1, 15).Value = "Choice E";

        var headerRange = worksheet.Range(1, 1, 1, 15);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

        int row = 2;
        foreach (var q in questions)
        {
            worksheet.Cell(row, 1).Value = q.Title;
            worksheet.Cell(row, 2).Value = string.Join(", ", q.QuestionCategoryAssignments
                .Where(link => !link.IsDeleted && link.Category is not null && !link.Category.IsDeleted)
                .OrderBy(link => link.Category!.Name)
                .Select(link => link.Category!.Name));
            worksheet.Cell(row, 3).Value = q.Text;
            worksheet.Cell(row, 4).Value = GetTypeName(q.Type);
            worksheet.Cell(row, 5).Value = q.Difficulty ?? "";
            worksheet.Cell(row, 6).Value = q.Points;

            var correctAnswers = q.Choices
                .Where(choice => choice.IsCorrect)
                .OrderBy(choice => choice.Order)
                .Select(choice => GetChoiceLetter(choice.Order))
                .Where(value => !string.IsNullOrWhiteSpace(value));
            worksheet.Cell(row, 7).Value = string.Join(",", correctAnswers);

            var orderedChoices = q.Choices.OrderBy(c => c.Order).ToList();
            for (int i = 0; i < 4 && i < orderedChoices.Count; i++)
            {
                worksheet.Cell(row, 8 + i).Value = orderedChoices[i].ChoiceText;
            }

            worksheet.Cell(row, 12).Value = q.Explanation ?? "";
            worksheet.Cell(row, 13).Value = q.AnswerSeconds;
            worksheet.Cell(row, 14).Value = q.SelectionMode.ToString();
            worksheet.Cell(row, 15).Value = orderedChoices.Count > 4 ? orderedChoices[4].ChoiceText : "";

            row++;
        }

        worksheet.Columns().AdjustToContents();

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        return stream;
    }

    private async Task<List<int>> ResolveExistingCategoryIdsAsync(QuestionCreateUpdateDto dto)
    {
        var requestedCategoryIds = dto.CategoryIds is null
            ? (dto.CategoryId.HasValue && dto.CategoryId.Value > 0
                ? new List<int> { dto.CategoryId.Value }
                : new List<int>())
            : dto.CategoryIds
                .Where(categoryId => categoryId > 0)
                .Distinct()
                .ToList();

        if (requestedCategoryIds.Count == 0)
        {
            return requestedCategoryIds;
        }

        var existingCategoryIds = await _context.Set<QuestionCategory>()
            .AsNoTracking()
            .Where(category => !category.IsDeleted && requestedCategoryIds.Contains(category.Id))
            .Select(category => category.Id)
            .ToListAsync();

        if (existingCategoryIds.Count != requestedCategoryIds.Count)
        {
            throw new ArgumentException("One or more selected question categories are invalid.");
        }

        return requestedCategoryIds
            .Where(categoryId => existingCategoryIds.Contains(categoryId))
            .ToList();
    }

    private static (string Name, string NormalizedName) NormalizeCategoryName(string? value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        return (trimmed, trimmed.ToUpperInvariant());
    }
}
