@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "AudEX local" cmd /k "py -m http.server 8000"
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    start "AudEX local" cmd /k "python -m http.server 8000"
  ) else (
    echo No se encontro Python. Usa VS Code con Live Server o instala Python.
    pause
    exit /b 1
  )
)
timeout /t 2 >nul
start "" "http://localhost:8000/"
endlocal
