@echo off
setlocal
cd /d "%~dp0.."

if exist ".\dist\agent-config.exe" (
  ".\dist\agent-config.exe"
) else (
  echo [agent-config] dist\agent-config.exe not found.
  echo [agent-config] Build first: npm run build:config:exe
  pause
)
