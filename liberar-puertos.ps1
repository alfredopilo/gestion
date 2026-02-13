# Script para liberar puertos requeridos por GestionEscolar antes de levantar Docker
# Puertos: 5434 (Postgres), 3001 (Backend), 80 (Frontend)
# Si un puerto está ocupado por un proceso, intenta detenerlo.
# Si el puerto está en rango excluido de Windows (ej. Hyper-V/WinNAT), intenta liberar.
# Si no se puede liberar, el script se detiene SIN modificar docker-compose.

$ErrorActionPreference = "Stop"
$ports = @(5434, 3001, 80)
$allOk = $true

function Test-PortInExcludedRange {
    param([int]$Port)
    $output = netsh interface ipv4 show excludedportrange protocol=tcp 2>&1 | Out-String
    # Formato: "      5387        5486" - dos numeros separados por espacios
    $matches = [regex]::Matches($output, '(?m)^\s*(\d+)\s+(\d+)\s*$')
    foreach ($m in $matches) {
        $start = [int]$m.Groups[1].Value
        $end = [int]$m.Groups[2].Value
        if ($Port -ge $start -and $Port -le $end) {
            return $true
        }
    }
    return $false
}

function Stop-ProcessUsingPort {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            $pid = $conn.OwningProcess | Select-Object -First 1
            if ($pid) {
                $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "[INFO] Deteniendo proceso $($proc.ProcessName) (PID $pid) que usa puerto $Port..."
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                    Write-Host "[OK] Proceso detenido correctamente" -ForegroundColor Green
                    return $true
                }
            }
        }
    } catch {
        Write-Host "[ERROR] No se pudo detener el proceso en puerto $Port : $_" -ForegroundColor Red
        return $false
    }
    return $null  # No habia proceso
}

function Try-FreeExcludedPort {
    param([int]$Port)
    Write-Host "[INFO] Puerto $Port está en rango excluido de Windows (Hyper-V/WinNAT)" -ForegroundColor Yellow
    Write-Host "[INFO] Intentando detener servicio WinNAT para liberar puertos..." -ForegroundColor Yellow
    try {
        net stop winnat 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Servicio WinNAT detenido. Los puertos excluidos pueden haberse liberado." -ForegroundColor Green
            Write-Host "[AVISO] Reinicia Docker Desktop y ejecuta el script nuevamente." -ForegroundColor Yellow
            return $true
        }
    } catch {
        Write-Host "[ERROR] No se pudo detener WinNAT. Ejecuta este script como Administrador." -ForegroundColor Red
    }
    return $false
}

Write-Host ""
Write-Host "=== Verificando puertos 5434, 3001, 80 ===" -ForegroundColor Cyan
Write-Host ""

foreach ($port in $ports) {
    Write-Host "Puerto $port : " -NoNewline
    
    # Verificar si hay proceso usando el puerto
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pid = $conn.OwningProcess | Select-Object -First 1
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        Write-Host "OCUPADO por $($proc.ProcessName) (PID $pid)" -ForegroundColor Yellow
        $result = Stop-ProcessUsingPort -Port $port
        if ($result -eq $false) {
            Write-Host "[FATAL] No se pudo liberar. Deteniendo sin modificar docker-compose." -ForegroundColor Red
            exit 1
        }
    } else {
        # No hay proceso - verificar si esta en rango excluido
        if (Test-PortInExcludedRange -Port $port) {
            Write-Host "EN RANGO EXCLUIDO de Windows" -ForegroundColor Yellow
            $freed = Try-FreeExcludedPort -Port $port
            if (-not $freed) {
                Write-Host ""
                Write-Host "[FATAL] Puerto $port en rango reservado. No se puede liberar." -ForegroundColor Red
                Write-Host "Opciones: 1) Ejecuta este script como Administrador" -ForegroundColor Yellow
                Write-Host "          2) Reinicia el equipo (puede cambiar rangos reservados)" -ForegroundColor Yellow
                Write-Host "          3) Reinicia Docker Desktop" -ForegroundColor Yellow
                Write-Host "NO se modificó docker-compose.yml" -ForegroundColor Cyan
                exit 1
            }
            $allOk = $false  # Requiere reinicio de Docker
        } else {
            Write-Host "OK (disponible)" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "[OK] Verificación de puertos completada" -ForegroundColor Green
exit 0
