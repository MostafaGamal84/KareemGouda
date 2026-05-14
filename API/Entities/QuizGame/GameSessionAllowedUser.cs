using Entities;

namespace API.Entities.QuizGame;

public class GameSessionAllowedUser : BaseEntity
{
    public int GameSessionId { get; set; }
    public int UserId { get; set; }
    public virtual GameSession GameSession { get; set; } = null!;
}
