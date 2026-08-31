@echo off
setlocal
cd /d "%~dp0"

echo Building native Windows deployment package...
echo This creates a ZIP that does not require Docker or WSL on the target PC.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0portable\BUILD-WINDOWS-NATIVE-ZIP.ps1"
if errorlevel 1 (
  echo.
  echo Native Windows package build failed.
  pause
  exit /b 1
)

echo.
echo Build complete. Look for AviationObstacleAnalysis-Windows.zip
echo in the parent folder of this repository.
pause
