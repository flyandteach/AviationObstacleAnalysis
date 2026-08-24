@echo off
cd /d "%~dp0.."
docker compose up -d
if errorlevel 1 (
  echo.
  echo Failed to start Aviation Obstacle Analysis.
  echo Make sure your Docker-compatible container runtime is running.
  pause
  exit /b 1
)
start "" http://localhost:5000
