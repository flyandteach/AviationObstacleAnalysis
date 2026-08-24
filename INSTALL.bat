@echo off
setlocal
cd /d "%~dp0"

if not exist "portable\INSTALL-ON-THIS-PC.ps1" (
  echo.
  echo ERROR: portable\INSTALL-ON-THIS-PC.ps1 was not found.
  echo This launcher must stay in the AviationObstacleAnalysis application folder.
  echo.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0portable\INSTALL-ON-THIS-PC.ps1"
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo.
  echo Installation ended with error code %EXITCODE%.
  pause
)

exit /b %EXITCODE%
