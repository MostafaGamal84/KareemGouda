using API.DTOs.Auth;
using API.Entities;
using API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private static readonly string[] AllowedSelfRegisterRoles = ["Host", "Player"];
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly ITokenService _tokenService;

    public AuthController(UserManager<AppUser> userManager, SignInManager<AppUser> signInManager, ITokenService tokenService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("fix-user-status")]
    public async Task<IActionResult> FixUserStatus()
    {
        var usersWithZeroStatus = await _userManager.Users.Where(u => u.Status == 0).ToListAsync();
        
        foreach (var user in usersWithZeroStatus)
        {
            user.Status = 1;
            await _userManager.UpdateAsync(user);
        }

        return Ok(new { message = $"Updated {usersWithZeroStatus.Count} users to active status" });
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequestDto dto)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var email = dto.Email.Trim().ToLowerInvariant();
        if (await _userManager.Users.AnyAsync(x => x.Email == email))
        {
            return BadRequest(new { message = "Email already exists" });
        }

        var role = string.IsNullOrWhiteSpace(dto.Role) ? "Host" : dto.Role.Trim();
        if (!AllowedSelfRegisterRoles.Contains(role, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Invalid role. Allowed roles: Host, Player" });
        }

        var user = new AppUser
        {
            UserName = email,
            Email = email,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            RegisterTime = DateTime.UtcNow,
            EmailConfirmed = true,
            Status = 0
        };

        var createResult = await _userManager.CreateAsync(user, dto.Password);
        if (!createResult.Succeeded)
        {
            return BadRequest(new { message = string.Join("; ", createResult.Errors.Select(e => e.Description)) });
        }

        await _userManager.AddToRoleAsync(user, role);

        return Ok(new { message = "Registration submitted successfully. Your account is pending approval by an administrator." });
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await _userManager.Users.SingleOrDefaultAsync(x => x.Email == email);

        if (user is null)
        {
            return Unauthorized(new { message = "Invalid email or password" });
        }

        var signInResult = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, false);
        if (!signInResult.Succeeded)
        {
            return Unauthorized(new { message = "Invalid email or password" });
        }

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new AuthResponseDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            FirstName = user.FirstName ?? string.Empty,
            LastName = user.LastName ?? string.Empty,
            Roles = roles,
            Token = _tokenService.CreateToken(user, roles),
            Status = user.Status
        });
    }
}
