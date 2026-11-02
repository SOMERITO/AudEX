@echo off
setlocal
cd /d "%~dp0"
title AudEX - Instalador y servidor local

echo.
echo ========================================
echo              AudEX LOCAL
echo ========================================
echo.

set "PY_CMD="
where py >nul 2>nul
if %errorlevel%==0 (
  py -3.11 --version >nul 2>nul
  if not errorlevel 1 set "PY_CMD=py -3.11"
  if not defined PY_CMD (
    py -3.12 --version >nul 2>nul
    if not errorlevel 1 set "PY_CMD=py -3.12"
  )
  if not defined PY_CMD (
    py -3 --version >nul 2>nul
    if not errorlevel 1 set "PY_CMD=py -3"
  )
)
if not defined PY_CMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PY_CMD=python"
)

if not defined PY_CMD (
  echo No se encontro Python.
  echo Instala Python 3.11 o 3.12 desde:
  echo https://www.python.org/downloads/windows/
  echo Durante la instalacion marca "Add Python to PATH".
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Creando entorno local de Python...
  %PY_CMD% -m venv .venv
  if errorlevel 1 goto :error
)

if not exist ".venv\audex_deps_installed" (
  echo [2/3] Instalando dependencias. Esto solo se realiza la primera vez...
  ".venv\Scripts\python.exe" -m pip install --upgrade pip
  if errorlevel 1 goto :error
  ".venv\Scripts\python.exe" -m pip install -r requirements-local.txt
  if errorlevel 1 goto :error
  echo listo>".venv\audex_deps_installed"
) else (
  echo Dependencias locales ya instaladas.
)

echo [3/3] Iniciando AudEX...
start "AudEX - Servidor local" cmd /k ""%CD%\.venv\Scripts\python.exe" server.py"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8765"
echo.
echo AudEX se esta abriendo en tu navegador.
echo Puedes cerrar esta ventana; no cierres la ventana del servidor mientras transcribes.
echo.
pause
exit /b 0

:error
echo.
echo Ocurrio un error instalando AudEX.
echo Revisa la conexion a internet y vuelve a ejecutar este archivo.
pause
exit /b 1
