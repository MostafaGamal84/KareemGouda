using API.Entities;
using API.Entities.QuizGame;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace API.Data;

public class DataContext : IdentityDbContext<AppUser, AppRole, int,
    IdentityUserClaim<int>, AppUserRole, IdentityUserLogin<int>,
    IdentityRoleClaim<int>, IdentityUserToken<int>>
{
    public DataContext(DbContextOptions options) : base(options)
    {
    }

    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionChoice> QuestionChoices => Set<QuestionChoice>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<QuestionCategory> QuestionCategories => Set<QuestionCategory>();
    public DbSet<QuestionCategoryAssignment> QuestionCategoryAssignments => Set<QuestionCategoryAssignment>();
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<QuizCategory> QuizCategories => Set<QuizCategory>();
    public DbSet<GameSession> GameSessions => Set<GameSession>();
    public DbSet<GameParticipant> GameParticipants => Set<GameParticipant>();
    public DbSet<GameSessionAllowedUser> GameSessionAllowedUsers => Set<GameSessionAllowedUser>();
    public DbSet<PlayerAnswer> PlayerAnswers => Set<PlayerAnswer>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<QuizAttemptAnswer> QuizAttemptAnswers => Set<QuizAttemptAnswer>();
    public DbSet<StudentGroup> StudentGroups => Set<StudentGroup>();
    public DbSet<StudentGroupMember> StudentGroupMembers => Set<StudentGroupMember>();
    public DbSet<QuizAccess> QuizAccesses => Set<QuizAccess>();
    public DbSet<QuizAccessUser> QuizAccessUsers => Set<QuizAccessUser>();
    public DbSet<QuizAccessGroup> QuizAccessGroups => Set<QuizAccessGroup>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<AppUser>()
            .HasMany(ur => ur.UserRoles)
            .WithOne(u => u.User)
            .HasForeignKey(ur => ur.UserId)
            .IsRequired();

        builder.Entity<AppRole>()
            .HasMany(ur => ur.UserRoles)
            .WithOne(u => u.Role)
            .HasForeignKey(ur => ur.RoleId)
            .IsRequired();

        builder.Entity<Question>()
            .HasMany(x => x.Choices)
            .WithOne(x => x.Question)
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Quiz>()
            .HasMany(x => x.QuizQuestions)
            .WithOne(x => x.Quiz)
            .HasForeignKey(x => x.QuizId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Quiz>()
            .HasMany(x => x.QuizCategories)
            .WithOne(x => x.Quiz)
            .HasForeignKey(x => x.QuizId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Category>()
            .HasMany(x => x.QuizCategories)
            .WithOne(x => x.Category)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Question>()
            .HasMany(x => x.QuizQuestions)
            .WithOne(x => x.Question)
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<QuestionCategory>()
            .HasMany(x => x.Questions)
            .WithOne(x => x.Category)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<Question>()
            .HasMany(x => x.QuestionCategoryAssignments)
            .WithOne(x => x.Question)
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<QuestionCategory>()
            .HasMany(x => x.QuestionCategoryAssignments)
            .WithOne(x => x.Category)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<GameSession>()
            .HasOne(x => x.Quiz)
            .WithMany()
            .HasForeignKey(x => x.QuizId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<GameSession>()
            .HasMany(x => x.Participants)
            .WithOne(x => x.GameSession)
            .HasForeignKey(x => x.GameSessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<GameSession>()
            .HasMany(x => x.AllowedUsers)
            .WithOne(x => x.GameSession)
            .HasForeignKey(x => x.GameSessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<GameSessionAllowedUser>()
            .HasIndex(x => new { x.GameSessionId, x.UserId })
            .IsUnique();

        builder.Entity<GameSession>()
            .HasMany(x => x.Answers)
            .WithOne(x => x.GameSession)
            .HasForeignKey(x => x.GameSessionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<GameParticipant>()
            .HasMany(x => x.Answers)
            .WithOne(x => x.Participant)
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<PlayerAnswer>()
            .HasOne(x => x.Question)
            .WithMany()
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<PlayerAnswer>()
            .HasOne(x => x.SelectedChoice)
            .WithMany()
            .HasForeignKey(x => x.SelectedChoiceId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.Entity<QuizAttempt>()
            .HasOne(x => x.Quiz)
            .WithMany()
            .HasForeignKey(x => x.QuizId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<QuizAttempt>()
            .HasMany(x => x.Answers)
            .WithOne(x => x.QuizAttempt)
            .HasForeignKey(x => x.QuizAttemptId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<QuizAttemptAnswer>()
            .HasOne(x => x.Question)
            .WithMany()
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<QuizAttemptAnswer>()
            .HasOne(x => x.SelectedChoice)
            .WithMany()
            .HasForeignKey(x => x.SelectedChoiceId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.Entity<GameSession>()
            .HasIndex(x => x.JoinCode)
            .IsUnique();

        builder.Entity<GameParticipant>()
            .HasIndex(x => new { x.GameSessionId, x.DisplayName })
            .IsUnique();

        builder.Entity<Category>()
            .HasIndex(x => x.NormalizedName)
            .IsUnique();

        builder.Entity<QuizCategory>()
            .HasIndex(x => new { x.QuizId, x.CategoryId })
            .IsUnique();

        builder.Entity<QuestionCategoryAssignment>()
            .HasIndex(x => new { x.QuestionId, x.CategoryId })
            .IsUnique();

        builder.Entity<StudentGroup>()
            .HasMany(x => x.Members)
            .WithOne(x => x.StudentGroup)
            .HasForeignKey(x => x.StudentGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<StudentGroupMember>()
            .HasOne(x => x.User)
            .WithMany(x => x.GroupMemberships)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<QuizAccess>()
            .HasOne(x => x.Quiz)
            .WithOne(x => x.QuizAccess)
            .HasForeignKey<QuizAccess>(x => x.QuizId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<QuizAccess>()
            .HasMany(x => x.AccessUsers)
            .WithOne(x => x.QuizAccess)
            .HasForeignKey(x => x.QuizAccessId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<QuizAccess>()
            .HasMany(x => x.AccessGroups)
            .WithOne(x => x.QuizAccess)
            .HasForeignKey(x => x.QuizAccessId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<QuizAccessGroup>()
            .HasOne(x => x.StudentGroup)
            .WithMany()
            .HasForeignKey(x => x.StudentGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<QuizAccessUser>()
            .HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<StudentGroup>()
            .HasIndex(x => x.Name);

        builder.Entity<UserPermission>()
            .HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<UserPermission>()
            .HasIndex(x => new { x.UserId, x.Permission })
            .IsUnique();
    }
}
