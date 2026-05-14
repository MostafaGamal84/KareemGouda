using API.Interfaces.QuizGame;

namespace API.Services.QuizGame;

public class TimedSessionAdvancerHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TimedSessionAdvancerHostedService> _logger;

    public TimedSessionAdvancerHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<TimedSessionAdvancerHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (!stoppingToken.IsCancellationRequested &&
               await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IGameSessionService>();
                await service.AutoAdvanceTimedSessionsAsync();
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Timed session auto-advance tick failed");
            }
        }
    }
}
