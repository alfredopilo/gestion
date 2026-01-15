@echo off
REM Script para restaurar backup en Windows
REM Uso: restaurar-backup.bat [ruta\al\archivo.sql.gz] [--force]

echo.
echo ========================================
echo   Restauracion de Backup - Base de Datos
echo ========================================
echo.

REM Verificar Docker Compose
where docker-compose >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set DC=docker-compose
) else (
    set DC=docker compose
)

REM Verificar argumentos
set BACKUP_FILE=%1
set FORCE=%2

if "%BACKUP_FILE%"=="" (
    set BACKUP_FILE=bak\backup_gestion_escolar_2026-01-15T23-24-05.sql.gz
    echo [AVISO] No se especifico archivo, usando: %BACKUP_FILE%
)

REM Verificar que el archivo existe
if not exist "%BACKUP_FILE%" (
    echo [ERROR] El archivo no existe: %BACKUP_FILE%
    exit /b 1
)

echo [OK] Archivo de backup encontrado: %BACKUP_FILE%
echo.

REM Verificar que PostgreSQL esta corriendo
%DC% ps postgres | find "Up" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PostgreSQL no esta corriendo
    echo Inicia los servicios con: %DC% up -d
    exit /b 1
)

echo [OK] PostgreSQL esta corriendo
echo.

REM Confirmar antes de restaurar (si no es --force)
if not "%FORCE%"=="--force" (
    echo [ADVERTENCIA] Esta accion reemplazara TODOS los datos actuales
    echo [ADVERTENCIA] de la base de datos. Esta accion NO se puede deshacer.
    echo.
    set /p CONFIRM="Estas seguro de que deseas continuar? (escribe SI): "
    
    if not "!CONFIRM!"=="SI" (
        echo [INFO] Operacion cancelada por el usuario
        exit /b 0
    )
)

echo.
echo [INFO] Iniciando restauracion...
echo.

REM Nota: Este script usa bash para ejecutar el script de restauracion
REM porque PowerShell no maneja bien los pipes complejos con Docker

bash -c "./restaurar-backup.sh '%BACKUP_FILE%' --force"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Restauracion completada exitosamente
    echo.
    echo [INFO] Recuerda reiniciar el backend:
    echo   %DC% restart backend
) else (
    echo [ERROR] Error al restaurar backup
    exit /b 1
)

exit /b 0
