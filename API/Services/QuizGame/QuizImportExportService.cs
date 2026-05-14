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
            qWs.Cell(row, 7).Value = q.Points;
            qWs.Cell(row, 8).Value = q.AnswerSeconds;
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

            var quizWs = workbook.Worksheet("Quiz Info");
            if (quizWs is null)
                return new ImportResultDto { Success = false, Message = "Sheet 'Quiz Info' not found" };

            var title = quizWs.Cell(2, 2).GetString();
            if (string.IsNullOrWhiteSpace(title))
                return new ImportResultDto { Success = false, Message = "Quiz title is required" };

            var description = quizWs.Cell(3, 2).GetString();
            var modeStr = quizWs.Cell(4, 2).GetString();
            var duration = quizWs.Cell(5, 2).GetValue<int>();
            var maxAttempts = quizWs.Cell(6, 2).GetValue<int>();
            var categoriesStr = quizWs.Cell(7, 2).GetString();

            var mode = Enum.TryParse<QuizMode>(modeStr, true, out var m) ? m : QuizMode.Test;

            var quiz = new Quiz
            {
                Title = title,
                Description = string.IsNullOrWhiteSpace(description) ? null : description,
                Mode = mode,
                DurationMinutes = duration > 0 ? duration : 30,
                MaxAttempts = maxAttempts > 0 ? maxAttempts : 1,
                IsPublished = false,
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Quizzes.Add(quiz);
            await _context.SaveChangesAsync();

            var quizAccess = new QuizAccess
            {
                QuizId = quiz.Id,
                AccessType = ExamAccessType.Public,
                MaxAttempts = quiz.MaxAttempts,
                TimerMinutes = quiz.DurationMinutes
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
                var qPoints = qWs.Cell(r, 7).GetValue<int>();
                var qAnswerSec = qWs.Cell(r, 8).GetValue<int>();
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
                    AnswerSeconds = qAnswerSec > 0 ? qAnswerSec : 30,
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

            var totalPts = quiz.QuizQuestions.Sum(qq =>
                qq.PointsOverride ?? qq.Question.Points);
            quiz.TotalMarks = totalPts;
            await _context.SaveChangesAsync();

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
}
