# Production Publish

## Build the deployable package

Run:

```powershell
.\scripts\publish-production.ps1
```

This command will:

1. Run `dotnet publish` for the API in `Release`.
2. Build the Angular frontend in production mode automatically.
3. Copy the frontend build into the publish output under `wwwroot`.
4. Create a ready-to-upload package in `publish\production`.
5. Create `publish\quiz-system-production.zip`.

## Required production settings

The application supports normal ASP.NET Core configuration overrides. On the server, prefer environment variables for secrets:

```text
ConnectionStrings__DefaultConnection
TokenKey
Cors__AllowedOrigins__0
Cors__AllowedOrigins__1
```

If you deploy to the same domain for frontend and API, the Angular production build already uses:

```text
/api
/hubs/live-game
```

## Important note about uploads

Uploaded quiz/question images live under `wwwroot\uploads`. If you have existing production uploads on the server, keep that folder when replacing the deployment package.
