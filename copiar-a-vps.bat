@echo off
REM Script para copiar archivos optimizados al VPS desde Windows
REM Uso: copiar-a-vps.bat [usuario@ip] [ruta-destino]

echo ================================================
echo   Copiar Archivos Optimizados al VPS
echo ================================================
echo.

REM Verificar si se proporcionaron argumentos
if "%~1"=="" (
    echo ERROR: Debes proporcionar el usuario e IP del VPS
    echo.
    echo Uso: copiar-a-vps.bat usuario@ip-del-vps /ruta/destino
    echo Ejemplo: copiar-a-vps.bat root@192.168.1.100 /root/GestionEscolar
    echo.
    pause
    exit /b 1
)

if "%~2"=="" (
    echo ERROR: Debes proporcionar la ruta destino en el VPS
    echo.
    echo Uso: copiar-a-vps.bat usuario@ip-del-vps /ruta/destino
    echo Ejemplo: copiar-a-vps.bat root@192.168.1.100 /root/GestionEscolar
    echo.
    pause
    exit /b 1
)

set VPS_HOST=%~1
set VPS_PATH=%~2

echo Host VPS: %VPS_HOST%
echo Ruta destino: %VPS_PATH%
echo.

REM Verificar que scp está disponible
where scp >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: scp no esta disponible
    echo.
    echo Opciones:
    echo   1. Instala OpenSSH: Configuracion ^> Aplicaciones ^> Caracteristicas opcionales ^> OpenSSH Client
    echo   2. Usa Git Bash incluido con Git for Windows
    echo   3. Usa WinSCP (interfaz grafica)
    echo.
    pause
    exit /b 1
)

echo Archivos a copiar:
echo   - vps-update.sh
echo   - VPS-GUIA-RAPIDA.md
echo   - vps-cleanup.sh
echo.

REM Confirmar
set /p CONFIRM="¿Continuar con la copia? (S/N): "
if /i not "%CONFIRM%"=="S" (
    echo Operacion cancelada
    pause
    exit /b 0
)

echo.
echo Copiando archivos...
echo.

REM Copiar vps-update.sh
echo [1/3] Copiando vps-update.sh...
scp vps-update.sh %VPS_HOST%:%VPS_PATH%/
if %ERRORLEVEL% NEQ 0 (
    echo ERROR al copiar vps-update.sh
    pause
    exit /b 1
)
echo OK

REM Copiar VPS-GUIA-RAPIDA.md
echo [2/3] Copiando VPS-GUIA-RAPIDA.md...
scp VPS-GUIA-RAPIDA.md %VPS_HOST%:%VPS_PATH%/
if %ERRORLEVEL% NEQ 0 (
    echo ERROR al copiar VPS-GUIA-RAPIDA.md
    pause
    exit /b 1
)
echo OK

REM Copiar vps-cleanup.sh
echo [3/3] Copiando vps-cleanup.sh...
scp vps-cleanup.sh %VPS_HOST%:%VPS_PATH%/
if %ERRORLEVEL% NEQ 0 (
    echo ERROR al copiar vps-cleanup.sh
    pause
    exit /b 1
)
echo OK

echo.
echo ================================================
echo   Archivos copiados exitosamente
echo ================================================
echo.
echo Ahora en el VPS ejecuta:
echo.
echo   ssh %VPS_HOST%
echo   cd %VPS_PATH%
echo   chmod +x vps-update.sh vps-cleanup.sh
echo   ./vps-update.sh
echo.

REM Preguntar si quiere conectarse automáticamente
set /p CONNECT="¿Conectar al VPS ahora? (S/N): "
if /i "%CONNECT%"=="S" (
    echo.
    echo Conectando a %VPS_HOST%...
    ssh %VPS_HOST% "cd %VPS_PATH% && chmod +x vps-update.sh vps-cleanup.sh && ls -lh vps-*.sh VPS-*.md"
)

echo.
echo Listo!
pause
