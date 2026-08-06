using API.DTOs.QuizGame;
using API.Entities.QuizGame;
using API.Interfaces.QuizGame;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

namespace API.Services.QuizGame;

public class QuizImportExportService : IQuizImportExportService
{
    private readonly DataContext _context;

    public QuizImportExportService(DataContext context)
    {
        _context = context;
    }

    public async Task<byte[]> ExportQuizToExcelAsync(int quizId)
    {
        var quiz = await _context.Quizzes
            .Include(q => q.QuizQuestions)
            .ThenInclude((QuizQuestion qq) => qq.Question)
            .ThenInclude(q => q.Choices)
            .Include(q => q.QuizQuestions)
            .ThenInclude((QuizQuestion qq) => qq.Question)
            .ThenInclude(q => q.QuestionCategoryAssignments)
            .ThenInclude(link => link.Category)
            .Include(q => q.QuizCategories)
            .ThenInclude(qc => qc.Category)
            .Include(q => q.QuizAccess)
            .FirstOrDefaultAsync(q => q.Id == quizId);

        if (quiz is null)
            throw new ArgumentException("Quiz not found");

        using var workbook = new XLWorkbook();

        var quizWs = workbook.Worksheets.Add("Quiz Info");
        quizWs.Cell(1, 1).Value = "Field";
        quizWs.Cell(1, 2).Value = "Value";
        
        quizWs.Cell(2, 1).Value = "Title";
        quizWs.Cell(2, 2).Value = quiz.Title;
        
        quizWs.Cell(3, 1).Value = "Description";
        quizWs.Cell(3, 2).Value = quiz.Description ?? "";
        
        quizWs.Cell(4, 1).Value = "Mode";
        quizWs.Cell(4, 2).Value = quiz.Mode.ToString();
        
        quizWs.Cell(5, 1).Value = "Duration (Minutes)";
        quizWs.Cell(5, 2).Value = quiz.DurationMinutes;
        
        quizWs.Cell(6, 1).Value = "Max Attempts";
        quizWs.Cell(6, 2).Value = quiz.MaxAttempts;
        
        quizWs.Cell(7, 1).Value = "Categories";
        quizWs.Cell(7, 2).Value = string.Join(", ", quiz.QuizCategories.Select(qc => qc.Category.Name));

        quizWs.Cell(8, 1).Value = "Total Marks";
        quizWs.Cell(8, 2).Value = quiz.TotalMarks ?? quiz.QuizQuestions.Sum(qq => qq.PointsOverride ?? qq.Question.Points);

        quizWs.Cell(9, 1).Value = "Published";
        quizWs.Cell(9, 2).Value = quiz.IsPublished;

        quizWs.Cell(10, 1).Value = "Exam Mode";
        quizWs.Cell(10, 2).Value = quiz.QuizAccess?.ExamMode.ToString() ?? ExamMode.Test.ToString();

        quizWs.Cell(11, 1).Value = "Access Type";
        quizWs.Cell(11, 2).Value = quiz.QuizAccess?.AccessType.ToString() ?? ExamAccessType.Public.ToString();

        quizWs.Cell(12, 1).Value = "Scheduled Start (UTC)";
        quizWs.Cell(12, 2).Value = quiz.QuizAccess?.ScheduledStartTime?.ToUniversalTime().ToString("O") ?? "";

        quizWs.Cell(13, 1).Value = "Scheduled End (UTC)";
        quizWs.Cell(13, 2).Value = quiz.QuizAccess?.ScheduledEndTime?.ToUniversalTime().ToString("O") ?? "";

        quizWs.Cell(14, 1).Value = "Timer Minutes";
        quizWs.Cell(14, 2).Value = quiz.QuizAccess?.TimerMinutes ?? 0;

        quizWs.Cell(15, 1).Value = "Time Convention";
        quizWs.Cell(15, 2).Value = "0 = Unlimited";

        quizWs.Column(1).Width = 20;
        quizWs.Column(2).Width = 40;

        var qWs = workbook.Worksheets.Add("Questions");
        var headerRow = 1;
        qWs.Cell(headerRow, 1).Value = "No";
        qWs.Cell(headerRow, 2).Value = "Question Title";
        qWs.Cell(headerRow, 3).Value = "Question Text";
        qWs.Cell(headerRow, 4).Value = "Type";
        qWs.Cell(headerRow, 5).Value = "Selection Mode";
        qWs.Cell(headerRow, 6).Value = "Difficulty";
        qWs.Cell(headerRow, 7).Value = "Points";
        qWs.Cell(headerRow, 8).Value = "Answer Seconds";
        qWs.Cell(headerRow, 9).Value = "Categories";
        qWs.Cell(headerRow, 10).Value = "Explanation";
        qWs.Cell(headerRow, 11).Value = "Choice 1";
        qWs.Cell(headerRow, 12).Value = "Choice 1 Correct";
        qWs.Cell(headerRow, 13).Value = "Choice 2";
        qWs.Cell(headerRow, 14).Value = "Choice 2 Correct";
        qWs.Cell(headerRow, 15).Value = "Choice 3";
        qWs.Cell(headerRow, 16).Value = "Choice 3 Correct";
        qWs.Cell(headerRow, 17).Value = "Choice 4";
        qWs.Cell(headerRow, 18).Value = "Choice 4 Correct";
        qWs.Cell(headerRow, 19).Value = "Choice 5";
        qWs.Cell(headerRow, 20).Value = "Choice 5 Correct";

        var headerRange = qWs.Range(headerRow, 1, headerRow, 20);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;

        var row = 2;
        var questionNumber = 1;
        foreach (var qq in quiz.QuizQuestions.OrderBy(q => q.Order))
        {
            var q = qq.Question;
            qWs.Cell(row, 1).Value = questionNumber++;
            qWs.Cell(row, 2).Value = q.Title;
            qWs.Cell(row, 3).Value = q.Text;
            qWs.Cell(row, 4).Value = q.Type.ToString();
            qWs.Cell(row, 5).Value = q.SelectionMode.ToString();
            qWs.Cell(row, 6).Value = q.Difficulty ?? "";
            qWs.Cell(row, 7).Value = qq.PointsOverride ?? q.Points;
            qWs.Cell(row, 8).Value = qq.AnswerSeconds;
            qWs.Cell(row, 9).Value = string.Join(", ", q.QuestionCategoryAssignments
                .Where(link => !link.IsDeleted && link.Category is not null && !link.Category.IsDeleted)
                .OrderBy(link => link.Category!.Name)
                .Select(link => link.Category!.Name));
            qWs.Cell(row, 10).Value = q.Explanation ?? "";

            var orderedChoices = q.Choices.OrderBy(c => c.Order).ToList();
            for (int i = 0; i < 5; i++)
            {
                var textCol = 11 + (i * 2);
                var correctCol = 12 + (i * 2);
                if (i < orderedChoices.Count)
                {
                    qWs.Cell(row, textCol).Value = orderedChoices[i].ChoiceText;
                    qWs.Cell(row, correctCol).Value = orderedChoices[i].IsCorrect ? "TRUE" : "FALSE";
                }
                else
                {
                    qWs.Cell(row, textCol).Value = "";
                    qWs.Cell(row, correctCol).Value = "";
                }
            }
            row++;
        }

        qWs.Columns(1, 10).AdjustToContents();
        qWs.Column(11).Width = 25;
        qWs.Column(12).Width = 14;
        qWs.Column(13).Width = 25;
        qWs.Column(14).Width = 14;
        qWs.Column(15).Width = 25;
        qWs.Column(16).Width = 14;
        qWs.Column(17).Width = 25;
        qWs.Column(18).Width = 14;
        qWs.Column(19).Width = 25;
        qWs.Column(20).Width = 14;

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public async Task<ImportResultDto> ImportQuizFromExcelAsync(byte[] fileContent, int userId)
    {
        try
        {
            using var stream = new MemoryStream(fileContent);
            using var workbook = new XLWorkbook(stream);
            await using var transaction = await _context.Database.BeginTransactionAsync();

            var quizWs = workbook.Worksheet("Quiz Info");
            if (quizWs is null)
                return new ImportResultDto { Success = false, Message = "Sheet 'Quiz Info' not found" };

            var info = ReadQuizInfo(quizWs);
            var title = GetInfo(info, "Title");
            if (string.IsNullOrWhiteSpace(title))
                return new ImportResultDto { Success = false, Message = "Quiz title is required" };

            var description = GetInfo(info, "Description");
            var modeStr = GetInfo(info, "Mode");
            var duration = ParseInt(GetInfo(info, "Duration (Minutes)"), 0);
            var maxAttempts = ParseInt(GetInfo(info, "Max Attempts"), 1);
            var categoriesStr = GetInfo(info, "Categories");
            var totalMarks = ParseNullableInt(GetInfo(info, "Total Marks"));
            var isPublished = ParseBool(GetInfo(info, "Published"));
            var examModeStr = GetInfo(info, "Exam Mode");
            var accessTypeStr = GetInfo(info, "Access Type");
            var scheduledStart = ParseUtcDateTime(GetInfo(info, "Scheduled Start (UTC)"));
            var scheduledEnd = ParseUtcDateTime(GetInfo(info, "Scheduled End (UTC)"));
            var timerMinutesRaw = ParseInt(GetInfo(info, "Timer Minutes"), 0);

            var mode = Enum.TryParse<QuizMode>(modeStr, true, out var m) ? m : QuizMode.Test;
            var examMode = Enum.TryParse<ExamMode>(examModeStr, true, out var parsedExamMode)
                ? parsedExamMode
                : ExamMode.Test;
            var accessType = Enum.TryParse<ExamAccessType>(accessTypeStr, true, out var parsedAccessType)
                ? parsedAccessType
                : ExamAccessType.Public;

            var quiz = new Quiz
            {
                Title = title,
                Description = string.IsNullOrWhiteSpace(description) ? null : description,
                Mode = mode,
                DurationMinutes = Math.Max(0, duration),
                MaxAttempts = maxAttempts > 0 ? maxAttempts : 1,
                TotalMarks = totalMarks,
                IsPublished = isPublished,
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Quizzes.Add(quiz);
            await _context.SaveChangesAsync();

            var quizAccess = new QuizAccess
            {
                QuizId = quiz.Id,
                ExamMode = examMode,
                AccessType = examMode == ExamMode.Live ? ExamAccessType.Public : accessType,
                MaxAttempts = quiz.MaxAttempts,
                ScheduledStartTime = scheduledStart,
                ScheduledEndTime = scheduledEnd,
                TimerMinutes = timerMinutesRaw > 0 ? timerMinutesRaw : null
            };
            _context.QuizAccesses.Add(quizAccess);

            if (!string.IsNullOrWhiteSpace(categoriesStr))
            {
                var categoryNames = categoriesStr.Split(',').Select(c => c.Trim()).ToList();
                foreach (var catName in categoryNames)
                {
                    var category = await _context.Categories.FirstOrDefaultAsync(c => c.Name == catName);
                    if (category is null)
                    {
                        category = new Category { Name = catName };
                        _context.Categories.Add(category);
                        await _context.SaveChangesAsync();
                    }
                    quiz.QuizCategories.Add(new QuizCategory { CategoryId = category.Id });
                }
                await _context.SaveChangesAsync();
            }

            var qWs = workbook.Worksheet("Questions");
            if (qWs is null)
                return new ImportResultDto { Success = false, Message = "Sheet 'Questions' not found" };

            var headerRow = 1;
            var lastRow = qWs.LastRowUsed()?.RowNumber() ?? headerRow;
            var questionOrder = 1;

            for (int r = headerRow + 1; r <= lastRow; r++)
            {
                var qTitle = qWs.Cell(r, 2).GetString();
                var qText = qWs.Cell(r, 3).GetString();
                if (string.IsNullOrWhiteSpace(qTitle) && string.IsNullOrWhiteSpace(qText))
                    continue;

                var qTypeStr = qWs.Cell(r, 4).GetString();
                var qSelModeStr = qWs.Cell(r, 5).GetString();
                var qDifficulty = qWs.Cell(r, 6).GetString();
                var qPoints = qWs.Cell(r, 7).IsEmpty() ? 1 : qWs.Cell(r, 7).GetValue<int>();
                var qAnswerSec = qWs.Cell(r, 8).IsEmpty() ? 30 : qWs.Cell(r, 8).GetValue<int>();
                var qCatName = qWs.Cell(r, 9).GetString();
                var qExplanation = qWs.Cell(r, 10).GetString();

                var qType = Enum.TryParse<QuestionType>(qTypeStr, true, out var qt) ? qt : QuestionType.MultipleChoice;
                var qSelMode = Enum.TryParse<QuestionSelectionMode>(qSelModeStr, true, out var sm) ? sm : QuestionSelectionMode.Single;

                var question = new Question
                {
                    Title = qTitle,
                    Text = qText,
                    Type = qType,
                    SelectionMode = qSelMode,
                    Difficulty = string.IsNullOrWhiteSpace(qDifficulty) ? null : qDifficulty,
                    Explanation = string.IsNullOrWhiteSpace(qExplanation) ? null : qExplanation,
                    Points = qPoints > 0 ? qPoints : 1,
                    AnswerSeconds = NormalizeAnswerSeconds(qAnswerSec),
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };

                var questionCategoryIds = new List<int>();
                var questionCategoryNames = qCatName
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                foreach (var categoryName in questionCategoryNames)
                {
                    var normalizedCategoryName = categoryName.ToUpperInvariant();
                    var category = await _context.QuestionCategories
                        .FirstOrDefaultAsync(c => c.Name.ToUpper() == normalizedCategoryName);

                    if (category is null)
                    {
                        category = new QuestionCategory
                        {
                            Name = categoryName,
                            CreatedAt = DateTime.UtcNow,
                            IsDeleted = false
                        };

                        _context.QuestionCategories.Add(category);
                        await _context.SaveChangesAsync();
                    }
                    else if (category.IsDeleted)
                    {
                        category.IsDeleted = false;
                        await _context.SaveChangesAsync();
                    }

                    questionCategoryIds.Add(category.Id);
                }

                if (questionCategoryIds.Count > 0)
                {
                    question.CategoryId = questionCategoryIds[0];
                    question.QuestionCategoryAssignments = questionCategoryIds
                        .Select(categoryId => new QuestionCategoryAssignment
                        {
                            CategoryId = categoryId,
                            IsDeleted = false
                        })
                        .ToList();
                }

                for (int i = 0; i < 5; i++)
                {
                    var textCol = 11 + (i * 2);
                    var correctCol = 12 + (i * 2);
                    var choiceText = qWs.Cell(r, textCol).GetString();
                    var isCorrectStr = qWs.Cell(r, correctCol).GetString();
                    var isCorrect = isCorrectStr?.ToUpper() == "TRUE";

                    if (!string.IsNullOrWhiteSpace(choiceText))
                    {
                        question.Choices.Add(new QuestionChoice
                        {
                            ChoiceText = choiceText,
                            IsCorrect = isCorrect,
                            Order = i + 1
                        });
                    }
                }

                _context.Questions.Add(question);
                await _context.SaveChangesAsync();

                quiz.QuizQuestions.Add(new QuizQuestion
                {
                    QuestionId = question.Id,
                    Order = questionOrder++,
                    AnswerSeconds = question.AnswerSeconds
                });
            }

            await _context.SaveChangesAsync();

            var totalPts = quiz.QuizQuestions.Sum(qq => qq.PointsOverride ?? qq.Question.Points);
            quiz.TotalMarks = totalMarks ?? totalPts;
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return new ImportResultDto
            {
                Success = true,
                Message = $"Quiz imported successfully with {quiz.QuizQuestions.Count} questions",
                QuizId = quiz.Id
            };
        }
        catch (Exception ex)
        {
            return new ImportResultDto
            {
                Success = false,
                Message = $"Import failed: {ex.Message}"
            };
        }
    }

    private static Dictionary<string, string> ReadQuizInfo(IXLWorksheet worksheet)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in worksheet.RowsUsed().Skip(1))
        {
            var key = row.Cell(1).GetString().Trim();
            if (!string.IsNullOrWhiteSpace(key))
            {
                values[key] = row.Cell(2).GetString().Trim();
            }
        }

        return values;
    }

    private static string GetInfo(IReadOnlyDictionary<string, string> info, string key)
        => info.TryGetValue(key, out var value) ? value : string.Empty;

    private static int ParseInt(string? value, int fallback)
        => int.TryParse(value, out var parsed) ? parsed : fallback;

    private static int? ParseNullableInt(string? value)
        => int.TryParse(value, out var parsed) ? parsed : null;

    private static bool ParseBool(string? value)
        => bool.TryParse(value, out var parsed) && parsed;

    private static DateTime? ParseUtcDateTime(string? value)
    {
        if (!DateTime.TryParse(value, null, System.Globalization.DateTimeStyles.RoundtripKind, out var parsed))
        {
            return null;
        }

        return parsed.ToUniversalTime();
    }

    private static int NormalizeAnswerSeconds(int value)
    {
        if (value == 0) return 0;
        if (value < 5) return 5;
        if (value > 300) return 300;
        return value;
    }
}
