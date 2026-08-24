param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$packageName = "AviationObstacleAnalysis-Portable"

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path (Split-Path -Parent $repoRoot) "$packageName.zip"
}

# Keep the staging path deliberately short. Windows PowerShell's Compress-Archive
# can fail on long FAA asset filenames when the normal %TEMP% path is used.
$shortBase = Join-Path $env:LOCALAPPDATA "AOA-PKG"
$tempRoot = Join-Path $shortBase ([guid]::NewGuid().ToString('N').Substring(0, 8))
$stage = Join-Path $tempRoot "AOA"

Write-Host "Creating portable package..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $stage -Force | Out-Null

try {
  # Copy the application while excluding local/build artifacts that should not be shipped.
  $excludeDirs = @('.git', 'node_modules', 'dist', '.cache', '.vite')
  $excludeFiles = @('*.log', 'AviationObstacleAnalysis-Portable.zip')

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

  if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
  }

  # Use the Windows bsdtar implementation instead of Compress-Archive.
  # bsdtar handles long filenames much more reliably. -a selects ZIP format
  # from the .zip extension.
  $tar = Get-Command tar.exe -ErrorAction Stop
  Write-Host "Archiving with tar.exe (long-path safe)..." -ForegroundColor Cyan
  & $tar.Source -a -c -f $OutputPath -C $tempRoot "AOA"
  if ($LASTEXITCODE -ne 0) {
    throw "tar.exe failed with exit code $LASTEXITCODE"
  }

  if (-not (Test-Path $OutputPath)) {
    throw "ZIP archive was not created."
  }
}
finally {
  if (Test-Path $tempRoot) {
    Remove-Item $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "Portable package created:" -ForegroundColor Green
Write-Host $OutputPath
Write-Host ""
Write-Host "On the other Windows computer:" -ForegroundColor Cyan
Write-Host "1. Install/start an approved Docker-compatible container runtime."
Write-Host "2. Extract the ZIP."
Write-Host "3. Open the extracted AOA folder."
Write-Host "4. Run portable\INSTALL-ON-THIS-PC.ps1 from PowerShell."
