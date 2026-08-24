param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$packageName = "AviationObstacleAnalysis-Portable"

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path (Split-Path -Parent $repoRoot) "$packageName.zip"
}

$tempRoot = Join-Path $env:TEMP "$packageName-$([guid]::NewGuid().ToString('N'))"
$stage = Join-Path $tempRoot $packageName

Write-Host "Creating portable package..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $stage -Force | Out-Null

# Copy the application while excluding local/build artifacts that should not be shipped.
$excludeDirs = @('.git', 'node_modules', 'dist', '.cache', '.vite')
$excludeFiles = @('*.log')

$robocopyArgs = @(
  $repoRoot,
  $stage,
  '/E',
  '/NFL',
  '/NDL',
  '/NJH',
  '/NJS',
  '/NP',
  '/XD'
) + $excludeDirs + @('/XF') + $excludeFiles

& robocopy @robocopyArgs | Out-Null
$rc = $LASTEXITCODE
if ($rc -gt 7) {
  throw "robocopy failed with exit code $rc"
}

# Do not recursively ship an older portable zip if one exists inside the repo folder.
Get-ChildItem -Path $stage -Filter '*.zip' -File -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

if (Test-Path $OutputPath) {
  Remove-Item $OutputPath -Force
}

Compress-Archive -Path $stage -DestinationPath $OutputPath -CompressionLevel Optimal
Remove-Item $tempRoot -Recurse -Force

Write-Host "" 
Write-Host "Portable package created:" -ForegroundColor Green
Write-Host $OutputPath
Write-Host ""
Write-Host "On the other Windows computer:" -ForegroundColor Cyan
Write-Host "1. Install/start an approved Docker-compatible container runtime."
Write-Host "2. Extract the ZIP."
Write-Host "3. Right-click portable\INSTALL-ON-THIS-PC.ps1 and run with PowerShell, or run it from PowerShell."
