@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

title LifeOS Launcher
echo.
echo Starting LifeOS from:
echo %ROOT%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install Node.js, then double-click this file again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found on PATH.
  echo Install Node.js/npm, then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%node_modules" (
  echo node_modules was not found. Running npm install first...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = '%ROOT%';" ^
  "$api = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue;" ^
  "$web = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue;" ^
  "if (-not $api) { Start-Process -FilePath 'cmd.exe' -ArgumentList '/k npm run dev:api' -WorkingDirectory $root -WindowStyle Minimized; Write-Host 'Started LifeOS API on http://127.0.0.1:8000'; } else { Write-Host 'LifeOS API already running on http://127.0.0.1:8000'; }" ^
  "if (-not $web) { Start-Process -FilePath 'cmd.exe' -ArgumentList '/k npm run dev:web' -WorkingDirectory $root -WindowStyle Minimized; Write-Host 'Started LifeOS UI on http://127.0.0.1:5173'; } else { Write-Host 'LifeOS UI already running on http://127.0.0.1:5173'; }" ^
  "Start-Sleep -Seconds 4;" ^
  "Start-Process 'http://127.0.0.1:5173';"

echo.
echo LifeOS should open in your browser now:
echo http://127.0.0.1:5173
echo.
echo You can close this launcher window. The API/UI run in their own windows.
echo To stop LifeOS, close the two npm terminal windows.
echo.
pause
