using API.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Data;

public static class Seed
{
    public static async Task SeedRoles(RoleManager<AppRole> roleManager)
    {
        var roles = new[] { "Admin", "Host", "Player" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new AppRole { Name = role });
            }
        }
    }

    public static async Task SeedDefaultUsers(UserManager<AppUser> userManager)
    {
        if (!await userManager.Users.AnyAsync())
        {
            var admin = new AppUser
            {
                UserName = "admin",
                Email = "Karim@admin.com",
                FirstName = "System",
                LastName = "Admin",
                RegisterTime = DateTime.UtcNow,
                EmailConfirmed = true,
                Status = 1
            };

            var host = new AppUser
            {
                UserName = "host",
                Email = "host@test.com",
                FirstName = "Default",
                LastName = "Host",
                RegisterTime = DateTime.UtcNow,
                EmailConfirmed = true,
                Status = 1
            };
             var player = new AppUser
            {
                UserName = "player",
                Email = "player@test.com",
                FirstName = "Default",
                LastName = "Player",
                RegisterTime = DateTime.UtcNow,
                EmailConfirmed = true,
                Status = 1
            };
                var player2 = new AppUser
            {
                UserName = "player2",
                Email = "player2@test.com",
                FirstName = "Default",
                LastName = "Player",
                RegisterTime = DateTime.UtcNow,
                EmailConfirmed = true,
                Status = 1
            };
                var player3 = new AppUser
            {
                UserName = "player3",
                Email = "player3@test.com",
                FirstName = "Default",
                LastName = "Player",
                RegisterTime = DateTime.UtcNow,
                EmailConfirmed = true,
                Status = 1
            };

            await userManager.CreateAsync(admin, "Admin@12345");
            await userManager.CreateAsync(host, "Host@12345");
            await userManager.CreateAsync(player, "Player@12345");
            await userManager.CreateAsync(player2, "Player2@12345");
            await userManager.CreateAsync(player3, "Player3@12345");
            await userManager.AddToRoleAsync(admin, "Admin");
            await userManager.AddToRoleAsync(host, "Host");
            await userManager.AddToRoleAsync(player, "Player");
            await userManager.AddToRoleAsync(player2, "Player");
            await userManager.AddToRoleAsync(player3, "Player");
        }
    }
}
