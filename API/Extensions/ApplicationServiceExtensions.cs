using API.Data;
using API.Interfaces;
using API.Interfaces.QuizGame;
using API.Services;
using API.Services.QuizGame;
using Microsoft.EntityFrameworkCore;

namespace API.Extensions;

public static class ApplicationServiceExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IQuestionService, QuestionService>();
        services.AddScoped<IQuizService, QuizService>();
        services.AddScoped<IGameSessionService, GameSessionService>();
        services.AddScoped<IPlayerService, PlayerService>();
        services.AddScoped<ITestModeService, TestModeService>();
        services.AddScoped<IResultsService, ResultsService>();
        services.AddScoped<IStudentGroupService, StudentGroupService>();
        services.AddScoped<IQuizAccessService, QuizAccessService>();
        services.AddScoped<IQuestionCategoryService, QuestionCategoryService>();
        services.AddScoped<IQuizImportExportService, QuizImportExportService>();
        services.AddScoped<IUserPermissionService, UserPermissionService>();
        services.AddHostedService<TimedSessionAdvancerHostedService>();

        services.AddDbContext<DataContext>(options =>
        {
            options.UseSqlServer(config.GetConnectionString("DefaultConnection"));
        });

        return services;
    }
}
