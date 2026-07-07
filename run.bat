@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Get-GymAvailability.ps1" -OpenReport
echo.
pause
