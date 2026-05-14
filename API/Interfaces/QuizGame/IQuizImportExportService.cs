using API.DTOs.QuizGame;

namespace API.Interfaces.QuizGame;

public interface IQuizImportExportService
{
    Task<byte[]> ExportQuizToExcelAsync(int quizId);
    Task<ImportResultDto> ImportQuizFromExcelAsync(byte[] fileContent, int userId);
}