@echo off
REM Script para copiar los nuevos scripts de solución al VPS

echo ============================================
echo    COPIAR SCRIPTS DE SOLUCION AL VPS
echo ============================================
echo.

REM Verificar que los archivos existen
if not exist "forzar-actualizacion.sh" (
    echo ERROR: No se encuentra forzar-actualizacion.sh
    pause
    exit /b 1
)

if not exist "diagnostico-vps.sh" (
    echo ERROR: No se encuentra diagnostico-vps.sh
    pause
    exit /b 1
)

echo Scripts encontrados:
echo   - forzar-actualizacion.sh
echo   - diagnostico-vps.sh
echo   - SOLUCION-CAMBIOS-NO-SE-REFLEJAN.md
echo   - LEEME-PRIMERO-VPS.md
echo.

REM Pedir datos del VPS
set /p VPS_IP="Ingresa la IP de tu VPS (ej: 142.93.17.71): "
set /p VPS_USER="Ingresa el usuario SSH (ej: root): "
set /p VPS_PATH="Ingresa la ruta del proyecto en VPS (ej: /root/GestionEscolar): "

echo.
echo Configuracion:
echo   IP:       %VPS_IP%
echo   Usuario:  %VPS_USER%
echo   Ruta:     %VPS_PATH%
echo.

set /p CONFIRM="¿Es correcta esta configuracion? (S/N): "
if /i not "%CONFIRM%"=="S" (
    echo Operacion cancelada
    pause
    exit /b 0
)

echo.
echo ============================================
echo    COPIANDO ARCHIVOS...
echo ============================================
echo.

REM Verificar que scp esté disponible
where scp >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: El comando 'scp' no esta disponible.
    echo.
    echo Opciones:
    echo   1. Instala Git for Windows que incluye scp
    echo   2. Instala OpenSSH Client desde Windows
    echo   3. Usa un cliente FTP/SFTP como FileZilla o WinSCP
    echo.
    echo Archivos a copiar manualmente:
    echo   - forzar-actualizacion.sh
    echo   - diagnostico-vps.sh
    echo   - SOLUCION-CAMBIOS-NO-SE-REFLEJAN.md
    echo   - LEEME-PRIMERO-VPS.md
    echo.
    pause
    exit /b 1
)

echo Copiando forzar-actualizacion.sh...
scp forzar-actualizacion.sh %VPS_USER%@%VPS_IP%:%VPS_PATH%/

echo Copiando diagnostico-vps.sh...
scp diagnostico-vps.sh %VPS_USER%@%VPS_IP%:%VPS_PATH%/

echo Copiando SOLUCION-CAMBIOS-NO-SE-REFLEJAN.md...
scp SOLUCION-CAMBIOS-NO-SE-REFLEJAN.md %VPS_USER%@%VPS_IP%:%VPS_PATH%/

echo Copiando LEEME-PRIMERO-VPS.md...
scp LEEME-PRIMERO-VPS.md %VPS_USER%@%VPS_IP%:%VPS_PATH%/

echo.
echo ============================================
echo    DANDO PERMISOS DE EJECUCION
echo ============================================
echo.

REM Dar permisos de ejecución a los scripts
echo Conectando al VPS para dar permisos...
ssh %VPS_USER%@%VPS_IP% "cd %VPS_PATH% && chmod +x forzar-actualizacion.sh diagnostico-vps.sh && ls -lh *.sh"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ============================================
    echo    ARCHIVOS COPIADOS EXITOSAMENTE
    echo ============================================
    echo.
    echo Los siguientes archivos fueron copiados al VPS:
    echo   - forzar-actualizacion.sh     ^(con permisos de ejecucion^)
    echo   - diagnostico-vps.sh          ^(con permisos de ejecucion^)
    echo   - SOLUCION-CAMBIOS-NO-SE-REFLEJAN.md
    echo   - LEEME-PRIMERO-VPS.md
    echo.
    echo SIGUIENTES PASOS:
    echo.
    echo 1. Conectate a tu VPS:
    echo    ssh %VPS_USER%@%VPS_IP%
    echo.
    echo 2. Ve al directorio del proyecto:
    echo    cd %VPS_PATH%
    echo.
    echo 3. Ejecuta el script de solucion:
    echo    ./forzar-actualizacion.sh
    echo.
    echo 4. O si prefieres ver el diagnostico primero:
    echo    ./diagnostico-vps.sh
    echo.
    echo 5. Lee la guia completa:
    echo    cat LEEME-PRIMERO-VPS.md
    echo.
) else (
    echo.
    echo ERROR: No se pudo copiar o dar permisos a los archivos
    echo.
    echo Verifica:
    echo   - Que la IP sea correcta: %VPS_IP%
    echo   - Que el usuario sea correcto: %VPS_USER%
    echo   - Que la ruta exista: %VPS_PATH%
    echo   - Que tengas acceso SSH al VPS
    echo.
)

pause
