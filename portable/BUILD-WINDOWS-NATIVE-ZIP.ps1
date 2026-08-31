param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$packageName = "AviationObstacleAnalysis-Windows"
$nodeVersion = "22.23.1"
$nodeArchive = "node-v$nodeVersion-win-x64.zip"
$nodeUrl = "https://nodejs.org/dist/v$nodeVersion/$nodeArchive"

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path (Split-Path -Parent $repoRoot) "$packageName.zip"
}

$shortBase = Join-Path $env:LOCALAPPDATA "AOA-NATIVE"
$tempRoot = Join-Path $shortBase ([guid]::NewGuid().ToString('N').Substring(0, 8))
$buildRoot = Join-Path $tempRoot "build"
$packageRoot = Join-Path $tempRoot $packageName
$nodeZip = Join-Path $tempRoot $nodeArchive
$nodeExtract = Join-Path $tempRoot "node"

Write-Host "Creating native Windows AviationObstacleAnalysis package..." -ForegroundColor Cyan
Write-Host "This package will not require Docker, WSL, PowerShell scripts, or a Node installation on the target PC."
Write-Host ""

New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
New-Item -ItemType Directory -Path $nodeExtract -Force | Out-Null

try {
  Write-Host "Copying application source to temporary build folder..." -ForegroundColor Yellow
  $excludeDirs = @('.git', 'node_modules', 'dist', '.cache', '.vite')
  $robocopyArgs = @(
    $repoRoot,
    $buildRoot,
    '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XD'
  ) + $excludeDirs + @('/XF', '*.log', 'AviationObstacleAnalysis-Portable.zip', 'AviationObstacleAnalysis-Windows.zip')

  & robocopy @robocopyArgs | Out-Null
  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with exit code $LASTEXITCODE"
  }

  Write-Host "Downloading official Node.js v$nodeVersion Windows x64 runtime..." -ForegroundColor Yellow
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip -UseBasicParsing

  Write-Host "Extracting Node.js runtime..." -ForegroundColor Yellow
  Expand-Archive -Path $nodeZip -DestinationPath $nodeExtract -Force
  $nodeDir = Join-Path $nodeExtract "node-v$nodeVersion-win-x64"
  $nodeExe = Join-Path $nodeDir "node.exe"
  $npmCmd = Join-Path $nodeDir "npm.cmd"
  if (-not (Test-Path $nodeExe) -or -not (Test-Path $npmCmd)) {
    throw "Downloaded Node.js runtime did not contain the expected Windows executables."
  }

  $oldPath = $env:PATH
  $env:PATH = "$nodeDir;$env:PATH"
  try {
    Push-Location $buildRoot
    try {
      Write-Host "Installing Windows application dependencies..." -ForegroundColor Yellow
      & $npmCmd ci
      if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }

      Write-Host "Building production application..." -ForegroundColor Yellow
      & $npmCmd run build
      if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE" }
    }
    finally {
      Pop-Location
    }
  }
  finally {
    $env:PATH = $oldPath
  }

  Write-Host "Assembling native Windows package..." -ForegroundColor Yellow
  New-Item -ItemType Directory -Path (Join-Path $packageRoot "runtime") -Force | Out-Null
  Copy-Item -Path "$nodeDir\*" -Destination (Join-Path $packageRoot "runtime") -Recurse -Force
  Copy-Item -Path (Join-Path $buildRoot "dist") -Destination $packageRoot -Recurse -Force
  Copy-Item -Path (Join-Path $buildRoot "attached_assets") -Destination $packageRoot -Recurse -Force
  Copy-Item -Path (Join-Path $buildRoot "node_modules") -Destination $packageRoot -Recurse -Force
  Copy-Item -Path (Join-Path $buildRoot "package.json") -Destination $packageRoot -Force

  $startBat = @'
@echo off
setlocal
cd /d "%~dp0"

if not exist "runtime\node.exe" (
  echo ERROR: runtime\node.exe is missing.
  pause
  exit /b 1
)
if not exist "dist\index.js" (
  echo ERROR: dist\index.js is missing.
  pause
  exit /b 1
)

set "NODE_ENV=production"
set "HOST=127.0.0.1"
set "PORT=5000"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":5000 .*LISTENING"') do (
  echo Port 5000 is already in use by process %%P.
  echo Opening the existing local service instead of starting a second copy.
  start "" http://localhost:5000
  exit /b 0
)

echo Starting Aviation Obstacle Analysis...
start "Aviation Obstacle Analysis Server" /min cmd.exe /c "set NODE_ENV=production&& set HOST=127.0.0.1&& set PORT=5000&& cd /d ""%~dp0""&& ""%~dp0runtime\node.exe"" ""%~dp0dist\index.js"" 1^>""%~dp0aoa-server.log"" 2^>^&1"

timeout /t 3 /nobreak >nul
curl.exe -fsS http://localhost:5000/healthz > "%TEMP%\aoa-health.txt" 2>nul
if errorlevel 1 (
  echo.
  echo The server did not respond yet.
  echo Check aoa-server.log in this folder for details.
  echo You can also run START.bat again after a few seconds.
  pause
  exit /b 1
)

echo.
echo Aviation Obstacle Analysis is running:
type "%TEMP%\aoa-health.txt"
echo.
del "%TEMP%\aoa-health.txt" >nul 2>&1
start "" http://localhost:5000
exit /b 0
'@
Set-Content -Path (Join-Path $packageRoot "START.bat") -Value $startBat -Encoding Ascii

  $stopBat = @'
@echo off
setlocal
echo Stopping Aviation Obstacle Analysis on port 5000...
set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":5000 .*LISTENING"') do (
  set "FOUND=1"
  echo Stopping process %%P...
  taskkill /PID %%P /F >nul 2>&1
)
if not defined FOUND echo No process is listening on port 5000.
exit /b 0
'@
Set-Content -Path (Join-Path $packageRoot "STOP.bat") -Value $stopBat -Encoding Ascii

  $readme = @'
AVIATION OBSTACLE ANALYSIS - NATIVE WINDOWS PACKAGE

This package does NOT require Docker, WSL, PowerShell scripts, Git, npm, or a separate Node.js installation.

TO RUN
1. Extract the entire ZIP to a normal folder on the local computer.
2. Double-click START.bat.
3. The application opens at http://localhost:5000.
4. To stop it, double-click STOP.bat.

VERIFY
Open http://localhost:5000/healthz and confirm the response includes:
  "status":"ok"
  "build":"oeaaa-clipboard-v4"

IMPORTANT
- Do not run START.bat from inside the ZIP preview. Extract everything first.
- Keep runtime, dist, node_modules, and attached_assets together with START.bat.
- The application is a planning/screening tool, not an FAA aeronautical determination.
'@
Set-Content -Path (Join-Path $packageRoot "README-FIRST.txt") -Value $readme -Encoding Ascii

  if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }
  $tar = Get-Command tar.exe -ErrorAction Stop
  Write-Host "Creating ZIP archive..." -ForegroundColor Yellow
  & $tar.Source -a -c -f $OutputPath -C $tempRoot $packageName
  if ($LASTEXITCODE -ne 0) { throw "tar.exe failed with exit code $LASTEXITCODE" }

  if (-not (Test-Path $OutputPath)) { throw "ZIP archive was not created." }
}
finally {
  if (Test-Path $tempRoot) {
    Remove-Item $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "Native Windows package created successfully:" -ForegroundColor Green
Write-Host $OutputPath
Write-Host ""
Write-Host "On the target Windows computer:" -ForegroundColor Cyan
Write-Host "1. Copy and extract the ZIP."
Write-Host "2. Open AviationObstacleAnalysis-Windows."
Write-Host "3. Double-click START.bat."
Write-Host "No Docker or WSL is required."
