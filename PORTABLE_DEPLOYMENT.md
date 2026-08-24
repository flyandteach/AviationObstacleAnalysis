# Portable Windows Deployment

This application can be packaged on one Windows computer and moved to another without requiring Replit or a Node.js development environment on the destination computer.

## What the destination computer needs

- Windows 10 or Windows 11
- An approved Docker-compatible container runtime installed and running
- Permission to run PowerShell scripts and containers
- Port 5000 available locally

The destination computer does not need Node.js, npm, TypeScript, Vite, or Replit.

## Create the portable ZIP

From PowerShell in the repository folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\portable\BUILD-PORTABLE-ZIP.ps1
```

The script creates:

```text
AviationObstacleAnalysis-Portable.zip
```

in the parent folder of the repository.

The ZIP excludes development/build artifacts such as `.git`, `node_modules`, and `dist`. The application is rebuilt in Docker on the destination computer.

## Install on another computer

1. Copy `AviationObstacleAnalysis-Portable.zip` to the destination computer.
2. Extract the ZIP to a normal writable folder such as Documents.
3. Make sure the approved Docker-compatible container runtime is installed and running.
4. Open PowerShell in the extracted `AviationObstacleAnalysis-Portable` folder.
5. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\portable\INSTALL-ON-THIS-PC.ps1
```

The script will build the container, start the application, verify `/healthz`, and open the application in the default browser.

The application is available at:

```text
http://localhost:5000
```

The health check is available at:

```text
http://localhost:5000/healthz
```

## Start later

Double-click:

```text
portable\START.bat
```

## Stop the application

Double-click:

```text
portable\STOP.bat
```

## Troubleshooting

Check container status:

```powershell
docker compose ps
```

Check recent application logs:

```powershell
docker compose logs --tail=100
```

Check whether port 5000 is already in use:

```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen
```

## Important deployment note

This remains a planning and screening application. It is not an FAA aeronautical determination and does not replace required FAA OE/AAA filing or review.
