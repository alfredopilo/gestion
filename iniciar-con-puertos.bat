@echo off
REM Inicia GestionEscolar liberando puertos ocupados primero.
REM Ejecuta como Administrador si los puertos estan en rango excluido de Windows.

cd /d "%~dp0"

echo.
echo === GestionEscolar - Inicio con verificacion de puertos ===
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0liberar-puertos.ps1"
if errorlevel 1 (
    echo.
    echo Intenta: Clic derecho en este archivo - "Ejecutar como administrador"
    pause
    exit /b 1
)

docker compose up -d
if errorlevel 1 (
    echo [ERROR] Fallo al levantar contenedores
    pause
    exit /b 1
)

echo.
echo [OK] Contenedores iniciados. Frontend: http://localhost  Backend: http://localhost:3001
pause
