@echo off
REM Script de instalación automática para Sistema de Gestión Escolar (Windows)
REM Este script automatiza el proceso de instalación

echo.
echo ============================================
echo Instalación del Sistema de Gestión Escolar
echo ============================================
echo.

REM Verificar Docker
echo Verificando requisitos...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker no está instalado. Por favor instala Docker Desktop primero.
    pause
    exit /b 1
)
echo [OK] Docker está instalado

docker compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose no está instalado. Por favor instala Docker Compose primero.
    pause
    exit /b 1
)
echo [OK] Docker Compose está instalado

REM Verificar si los servicios ya están corriendo
docker compose ps | findstr "Up" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo [ADVERTENCIA] Los servicios ya están corriendo.
    set /p response="¿Deseas reiniciarlos? (s/n): "
    if /i "%response%"=="s" (
        echo Deteniendo servicios existentes...
        docker compose down
    ) else (
        echo Saltando inicio de servicios...
        pause
        exit /b 0
    )
)

REM Crear archivos .env si no existen
echo.
echo Configurando archivos de entorno...
if not exist .env (
    echo [ADVERTENCIA] No se encontró .env en la raíz. Usando valores por defecto.
    echo Puedes crear .env manualmente si necesitas personalizar la configuración.
) else (
    echo [OK] Archivo .env encontrado en la raíz
)

REM Verificar y liberar puertos (5434, 3001, 80) antes de levantar
echo.
echo Verificando puertos...
powershell -ExecutionPolicy Bypass -File "%~dp0liberar-puertos.ps1"
if errorlevel 1 (
    echo.
    echo [ERROR] No se pudieron liberar los puertos. El script se detuvo.
    echo No se modificó docker-compose.yml
    pause
    exit /b 1
)

REM Levantar servicios
echo.
echo Levantando servicios Docker...
docker compose up -d
if errorlevel 1 (
    echo [ERROR] Error al levantar los servicios. Verifica los logs.
    pause
    exit /b 1
)

REM Esperar a que PostgreSQL esté listo
echo.
echo Esperando a que PostgreSQL esté listo...
timeout /t 10 /nobreak >nul

REM Configurar base de datos
echo.
echo Configurando base de datos...
echo   Generando cliente de Prisma...
docker compose exec -T backend npm run prisma:generate
if errorlevel 1 (
    echo [ERROR] Error al generar cliente de Prisma
    pause
    exit /b 1
)

echo   Ejecutando migraciones...
docker compose exec -T backend npm run prisma:migrate
if errorlevel 1 (
    echo [ERROR] Error al ejecutar migraciones
    pause
    exit /b 1
)

echo   Poblando base de datos con datos iniciales...
docker compose exec -T backend npm run prisma:seed
if errorlevel 1 (
    echo [ERROR] Error al poblar la base de datos
    pause
    exit /b 1
)

echo [OK] Base de datos configurada correctamente

REM Esperar un poco más
echo.
echo Verificando servicios...
timeout /t 5 /nobreak >nul

REM Mostrar información final
echo.
echo ============================================
echo ¡Instalación completada!
echo ============================================
echo.
echo Accesos:
echo   - Frontend:        http://localhost:5173
echo   - Backend API:      http://localhost:3000
echo   - API Docs:        http://localhost:3000/api-docs
echo.
echo Credenciales de acceso:
echo   - Admin:           admin@gestionescolar.edu / admin123
echo   - Profesor:        profesor@gestionescolar.edu / profesor123
echo   - Estudiante:      estudiante@gestionescolar.edu / estudiante123
echo   - Representante:   representante@gestionescolar.edu / representante123
echo.
echo Comandos útiles:
echo   - Ver logs:        docker compose logs -f
echo   - Detener:         docker compose down
echo   - Reiniciar:       docker compose restart
echo.
echo Para más información, consulta INSTALACION.md
echo.
pause

