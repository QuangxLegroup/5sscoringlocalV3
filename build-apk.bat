@echo off
setlocal
set "SERVER_URL=%~1"
if "%SERVER_URL%"=="" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-apk.ps1"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-apk.ps1" -ServerUrl "%SERVER_URL%"
)
exit /b %ERRORLEVEL%
