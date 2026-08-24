@echo off
setlocal
cd /d "%~dp0"

echo Aviation Obstacle Analysis - portable setup
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker was not found on this computer.
  echo Install and start an approved Docker-compatible container runtime first.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker is installed, but the container engine is not running.
  echo Start the approved container runtime, then run INSTALL.bat again.
  pause
  exit /b 1
)

echo Stopping any older AviationObstacleAnalysis container...
docker compose down --remove-orphans >nul 2>&1

echo Building the application...
docker compose build --pull
if errorlevel 1 (
  echo.
  echo ERROR: Docker build failed.
  pause
  exit /b 1
)

echo Starting the application...
docker compose up -d --force-recreate
if errorlevel 1 (
  echo.
  echo ERROR: Docker startup failed.
  pause
  exit /b 1
)

echo Checking application health...
set "HEALTHFILE=%TEMP%\aoa-health-%RANDOM%.txt"
set /a COUNT=0

:healthcheck
set /a COUNT+=1
timeout /t 1 /nobreak >nul
curl.exe -fsS http://localhost:5000/healthz > "%HEALTHFILE%" 2>nul
if not errorlevel 1 (
  findstr /C:"\"status\":\"ok\"" "%HEALTHFILE%" >nul 2>&1
  if not errorlevel 1 goto healthy
)
if %COUNT% LSS 30 goto healthcheck

echo.
echo ERROR: The container started, but the health check did not respond successfully.
echo Run: docker compose logs --tail=100
del "%HEALTHFILE%" >nul 2>&1
pause
exit /b 1

:healthy
echo.
echo Application is running.
type "%HEALTHFILE%"
echo.
del "%HEALTHFILE%" >nul 2>&1
echo Opening http://localhost:5000
start "" http://localhost:5000
exit /b 0
