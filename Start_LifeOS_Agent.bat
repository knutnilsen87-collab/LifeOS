@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

call "%ROOT%Start_LifeOS.bat" --no-pause

start "LifeOS Agent" powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%agent\windows\LifeOSAgent.ps1"
