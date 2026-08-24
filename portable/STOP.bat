@echo off
cd /d "%~dp0.."
docker compose down
if errorlevel 1 (
  echo.
  echo Could not stop Aviation Obstacle Analysis cleanly.
  pause
  exit /b 1
)
echo Aviation Obstacle Analysis stopped.
