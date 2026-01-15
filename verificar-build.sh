#!/bin/bash

# Script para verificar si un build de Docker está activo o colgado

echo "🔍 Verificador de Build Docker"
echo "=============================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Detectar docker compose
if command -v docker-compose &> /dev/null; then
    DC="docker-compose"
else
    DC="docker compose"
fi

print_info "Verificando procesos de Docker Build..."
echo ""

# Buscar procesos de docker build
BUILD_PROCESSES=$(ps aux | grep -E "docker.*build|docker-compose.*build" | grep -v grep)

if [ -z "$BUILD_PROCESSES" ]; then
    print_info "No hay procesos de build activos"
else
    print_warning "Procesos de build encontrados:"
    echo "$BUILD_PROCESSES" | while read line; do
        PID=$(echo "$line" | awk '{print $2}')
        CPU=$(echo "$line" | awk '{print $3}')
        MEM=$(echo "$line" | awk '{print $4}')
        CMD=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf $i" "; print ""}')
        print_info "  PID: $PID | CPU: ${CPU}% | MEM: ${MEM}%"
        print_info "  Cmd: $CMD"
    done
    echo ""
fi

# Verificar logs de build
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "Verificando logs de build..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "/tmp/build-backend-forzado.log" ]; then
    print_success "Log de backend encontrado"
    BACKEND_SIZE=$(stat -f%z /tmp/build-backend-forzado.log 2>/dev/null || stat -c%s /tmp/build-backend-forzado.log 2>/dev/null || echo 0)
    BACKEND_LINES=$(wc -l < /tmp/build-backend-forzado.log 2>/dev/null || echo 0)
    print_info "  Tamaño: $(numfmt --to=iec-i --suffix=B $BACKEND_SIZE 2>/dev/null || echo "${BACKEND_SIZE} bytes")"
    print_info "  Líneas: $BACKEND_LINES"
    
    # Verificar última modificación
    LAST_MOD=$(stat -f "%Sm" /tmp/build-backend-forzado.log 2>/dev/null || stat -c "%y" /tmp/build-backend-forzado.log 2>/dev/null | cut -d'.' -f1)
    print_info "  Última modificación: $LAST_MOD"
    
    # Mostrar últimas líneas
    echo ""
    print_info "Últimas 10 líneas del log de backend:"
    tail -10 /tmp/build-backend-forzado.log | while read line; do
        echo "  $line"
    done
else
    print_info "Log de backend no encontrado"
fi

echo ""

if [ -f "/tmp/build-frontend-forzado.log" ]; then
    print_success "Log de frontend encontrado"
    FRONTEND_SIZE=$(stat -f%z /tmp/build-frontend-forzado.log 2>/dev/null || stat -c%s /tmp/build-frontend-forzado.log 2>/dev/null || echo 0)
    FRONTEND_LINES=$(wc -l < /tmp/build-frontend-forzado.log 2>/dev/null || echo 0)
    print_info "  Tamaño: $(numfmt --to=iec-i --suffix=B $FRONTEND_SIZE 2>/dev/null || echo "${FRONTEND_SIZE} bytes")"
    print_info "  Líneas: $FRONTEND_LINES"
    
    # Verificar última modificación
    LAST_MOD=$(stat -f "%Sm" /tmp/build-frontend-forzado.log 2>/dev/null || stat -c "%y" /tmp/build-frontend-forzado.log 2>/dev/null | cut -d'.' -f1)
    print_info "  Última modificación: $LAST_MOD"
    
    # Verificar si el archivo sigue creciendo (signo de actividad)
    sleep 2
    NEW_SIZE=$(stat -f%z /tmp/build-frontend-forzado.log 2>/dev/null || stat -c%s /tmp/build-frontend-forzado.log 2>/dev/null || echo 0)
    if [ "$NEW_SIZE" -gt "$FRONTEND_SIZE" ]; then
        print_success "El log está creciendo → Build ACTIVO"
        SIZE_DIFF=$((NEW_SIZE - FRONTEND_SIZE))
        print_info "  Crecimiento en 2 segundos: ${SIZE_DIFF} bytes"
    else
        print_warning "El log NO está creciendo → Posiblemente COLGADO"
    fi
    
    echo ""
    print_info "Últimas 15 líneas del log de frontend:"
    tail -15 /tmp/build-frontend-forzado.log | while read line; do
        echo "  $line"
    done
else
    print_info "Log de frontend no encontrado"
fi

echo ""

# Verificar recursos del sistema
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "Recursos del Sistema"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v free &> /dev/null; then
    print_info "Memoria:"
    free -h | grep -E "Mem|Swap" | while read line; do
        print_info "  $line"
    done
    
    MEM_FREE=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [ "$MEM_FREE" -lt 500 ]; then
        print_error "Memoria disponible MUY BAJA (${MEM_FREE}MB)"
        print_warning "El build puede fallar por falta de memoria"
    elif [ "$MEM_FREE" -lt 1000 ]; then
        print_warning "Memoria disponible baja (${MEM_FREE}MB)"
        print_info "El build puede ser lento"
    else
        print_success "Memoria disponible OK (${MEM_FREE}MB)"
    fi
    echo ""
fi

if command -v df &> /dev/null; then
    print_info "Espacio en disco:"
    df -h . | tail -1 | awk '{print "  " $2 " total, " $4 " disponible (" $5 " usado)"}'
    echo ""
fi

if command -v top &> /dev/null || command -v htop &> /dev/null; then
    print_info "Uso de CPU (top 3 procesos de Docker):"
    ps aux | grep -E "docker|node|npm|vite" | grep -v grep | sort -k3 -rn | head -3 | while read line; do
        PID=$(echo "$line" | awk '{print $2}')
        CPU=$(echo "$line" | awk '{print $3}')
        MEM=$(echo "$line" | awk '{print $4}')
        CMD=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf $i" "; print ""}' | cut -c1-60)
        print_info "  CPU: ${CPU}% | MEM: ${MEM}% | $CMD"
    done
    echo ""
fi

# Verificar contenedores
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "Estado de Contenedores"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

$DC ps 2>/dev/null || print_warning "Docker Compose no responde"

echo ""

# Recomendaciones
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "Recomendaciones"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "/tmp/build-frontend-forzado.log" ]; then
    # Verificar si el build parece colgado
    LAST_LINE=$(tail -1 /tmp/build-frontend-forzado.log 2>/dev/null)
    TIME_SINCE_MOD=$(($(date +%s) - $(stat -f %m /tmp/build-frontend-forzado.log 2>/dev/null || stat -c %Y /tmp/build-frontend-forzado.log 2>/dev/null || echo 0)))
    
    if [ "$TIME_SINCE_MOD" -gt 600 ]; then  # Más de 10 minutos sin cambios
        print_error "El build parece estar COLGADO"
        print_warning "No hay cambios en el log desde hace ${TIME_SINCE_MOD} segundos (~$((TIME_SINCE_MOD / 60)) minutos)"
        echo ""
        print_info "OPCIONES:"
        echo "  1. Matar el proceso de build:"
        echo "     pkill -f 'docker.*build.*frontend'"
        echo ""
        echo "  2. Reintentar el build:"
        echo "     docker compose build --no-cache frontend"
        echo ""
        echo "  3. Ver log completo para identificar error:"
        echo "     tail -100 /tmp/build-frontend-forzado.log | grep -i error"
    else
        print_success "El build parece estar ACTIVO"
        print_info "Última actividad hace $((TIME_SINCE_MOD / 60)) minutos"
        echo ""
        print_info "MONITOREO EN TIEMPO REAL:"
        echo "  watch -n 5 'tail -10 /tmp/build-frontend-forzado.log'"
        echo ""
        print_info "VER TODO EL PROGRESO:"
        echo "  tail -f /tmp/build-frontend-forzado.log"
    fi
else
    print_info "No hay build activo detectado"
fi

echo ""
