$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Aviation Obstacle Analysis - portable setup" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker-compatible command was not found on this computer." -ForegroundColor Red
  Write-Host "Install and start an approved Docker-compatible container runtime, then run this script again."
  exit 1
}

try {
  docker info *> $null
} catch {
  Write-Host "Docker is installed but the container engine is not running." -ForegroundColor Red
  Write-Host "Start the container runtime and run this script again."
  exit 1
}

Write-Host "Stopping any older AviationObstacleAnalysis container..." -ForegroundColor Yellow
docker compose down --remove-orphans 2>$null | Out-Null

Write-Host "Building the application..." -ForegroundColor Yellow
docker compose build --pull
if ($LASTEXITCODE -ne 0) { throw "Docker build failed." }

Write-Host "Starting the application..." -ForegroundColor Yellow
docker compose up -d --force-recreate
if ($LASTEXITCODE -ne 0) { throw "Docker startup failed." }

$healthUrl = "http://localhost:5000/healthz"
$appUrl = "http://localhost:5000"
$healthy = $false

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($health.status -eq "ok") {
      $healthy = $true
      Write-Host ""
      Write-Host "Application is running." -ForegroundColor Green
      if ($health.build) {
        Write-Host "Build: $($health.build)"
      }
      break
    }
  } catch {
    # Continue waiting briefly for container startup.
  }
}

if (-not $healthy) {
  Write-Host "The container started, but the health check did not respond successfully." -ForegroundColor Red
  Write-Host "Run: docker compose logs --tail=100"
  exit 1
}

Write-Host "Opening $appUrl" -ForegroundColor Cyan
Start-Process $appUrl
