using API.DTOs.QuizGame;

namespace API.Interfaces.QuizGame;

public interface IStudentGroupService
{
    Task<PagedResultDto<StudentGroupDto>> GetAllAsync(StudentQueryDto query);
    Task<StudentGroupDto?> GetByIdAsync(int id);
    Task<StudentGroupDto> CreateAsync(StudentGroupCreateUpdateDto dto, int userId);
    Task<StudentGroupDto?> UpdateAsync(int id, StudentGroupCreateUpdateDto dto);
    Task<bool> DeleteAsync(int id);
    Task<StudentGroupDto?> AddMembersAsync(int id, StudentGroupAddMembersDto dto);
    Task<StudentGroupDto?> RemoveMemberAsync(int id, int memberId);
    Task<StudentGroupDto?> UpdateMemberStatusAsync(int id, int memberId, StudentGroupUpdateMemberStatusDto dto);
    Task<PagedResultDto<StudentListDto>> GetStudentsAsync(StudentQueryDto query);
    Task<bool> ApproveStudentAsync(int userId, StudentApprovalDto dto);
}
