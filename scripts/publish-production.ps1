# =====================================================
# Quiz System Production Publish Script
# =====================================================
# This script builds and packages the entire application
# (Backend + Frontend) for production deployment.
#
# Usage:
#   .\publish-production.ps1
#   .\publish-production.ps1 -SkipZip       # Build without creating ZIP
#   .\publish-production.ps1 -SkipFrontend   # Skip frontend build (use existing)
# =====================================================

param(
    [string]$OutputDir = 'publish\production',
    [string]$ZipName = 'quiz-system-production.zip',
    [switch]$SkipZip,
    [switch]$SkipFrontend
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$publishDir = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputDir))
$apiDir = Join-Path $repoRoot 'API'
$frontDir = Join-Path $repoRoot 'front'
$wwwrootDir = Join-Path $publishDir 'wwwroot'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Quiz System Production Publisher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Validate paths
if (-not $publishDir.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Output directory must stay inside the repository."
}

# Clean previous output
Write-Host "[1/4] Cleaning previous output..." -ForegroundColor Yellow
if (Test-Path -LiteralPath $publishDir) {
    Remove-Item -LiteralPath $publishDir -Recurse -Force
}
New-Item -ItemType Directory -Path $publishDir | Out-Null

# Build Backend
Write-Host "[2/4] Building Backend (.NET)..." -ForegroundColor Yellow
Push-Location $repoRoot
try {
    dotnet publish $apiDir -c Release -o $publishDir --no-restore
    if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }
    Write-Host "      Backend built successfully" -ForegroundColor Green
}
finally {
    Pop-Location
}

# Build Frontend (if not skipped)
if (-not $SkipFrontend) {
    Write-Host "[3/4] Building Frontend (Angular)..." -ForegroundColor Yellow
    Push-Location $frontDir
    try {
        # Install dependencies if needed
        if (-not (Test-Path 'node_modules')) {
            Write-Host "      Installing npm dependencies..." -ForegroundColor Gray
            npm install --legacy-peer-deps
        }
        
        # Build Angular
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
        Write-Host "      Frontend built successfully" -ForegroundColor Green
        
        # Copy frontend build to wwwroot
        $frontDist = Join-Path $frontDir 'dist\front'
        if (Test-Path $frontDist) {
            Copy-Item -Path $frontDist -Destination $wwwrootDir -Recurse -Force
            Write-Host "      Frontend copied to wwwroot" -ForegroundColor Green
        }
        else {
            # Try alternative path
            $altDist = Join-Path $frontDir 'dist\front\browser'
            if (Test-Path $altDist) {
                Copy-Item -Path $altDist -Destination $wwwrootDir -Recurse -Force
                Write-Host "      Frontend (browser) copied to wwwroot" -ForegroundColor Green
            }
            else {
                Write-Host "      Warning: Frontend dist folder not found" -ForegroundColor DarkYellow
            }
        }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "[3/4] Skipping Frontend build (using existing files)" -ForegroundColor Gray
}

# Create ZIP (if not skipped)
if (-not $SkipZip) {
    Write-Host "[4/4] Creating ZIP package..." -ForegroundColor Yellow
    $zipPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "publish\$ZipName"))
    
    if (-not $zipPath.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Zip output must stay inside the repository."
    }

    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }

    # MSBuild can briefly keep handles under publish\ (e.g. BuildHost); wait and retry.
    $zipAttempts = 5
    $zipDelaySec = 3
    $zipOk = $false
    for ($i = 1; $i -le $zipAttempts; $i++) {
        if ($i -gt 1) { Start-Sleep -Seconds $zipDelaySec }
        try {
            Compress-Archive -Path (Join-Path $publishDir '*') -DestinationPath $zipPath -Force -ErrorAction Stop
            $zipOk = $true
            break
        }
        catch {
            if ($i -eq $zipAttempts) { throw }
            Write-Host "      Zip attempt $i failed (file in use); retrying..." -ForegroundColor DarkYellow
        }
    }
    if (-not $zipOk) { throw "ZIP creation failed after $zipAttempts attempts." }
    Write-Host "      ZIP created: $zipPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Production publish completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Output directories:" -ForegroundColor Cyan
Write-Host "  - Backend:  $publishDir" -ForegroundColor White
Write-Host "  - Frontend: $wwwrootDir" -ForegroundColor White
if (-not $SkipZip) {
    Write-Host "  - ZIP:      $zipPath" -ForegroundColor White
}
Write-Host ""

# Show next steps
Write-Host "Next steps for deployment:" -ForegroundColor Yellow
Write-Host "  1. Upload the ZIP to your server" -ForegroundColor White
Write-Host "  2. Extract to your deployment folder" -ForegroundColor White
Write-Host "  3. Set environment variables:" -ForegroundColor White
Write-Host "     - ConnectionStrings__DefaultConnection" -ForegroundColor Gray
Write-Host "     - TokenKey" -ForegroundColor Gray
Write-Host "     - Cors__AllowedOrigins__0" -ForegroundColor Gray
Write-Host "  4. Run: dotnet API.dll" -ForegroundColor White
Write-Host ""