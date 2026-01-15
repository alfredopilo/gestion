#!/bin/bash

# Script ligero para actualizar SOLO el backend
# Útil cuando solo cambiaste código del backend o cuando el frontend tarda demasiado

set -e

echo "⚡ ACTUALIZACIÓN SOLO BACKEND - Sistema de Gestión Escolar"
echo "=========================================================="
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

print_info "Este script actualizará SOLO el backend"
print_warning "El frontend NO se actualizará (se mantendrá la versión anterior)"
echo ""

read -p "¿Continuar? (s/n): " -n 1 -r
echo
[[ ! $REPLY =~ ^[Ss]$ ]] && exit 0

echo ""

# ============================================
# PASO 1: Rebuild del Backend
# ============================================
print_info "PASO 1: Reconstruyendo backend..."
echo ""

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

print_warning "Backend: Reconstruyendo... (esto puede tardar 2-5 minutos)"
echo ""

# Rebuild con caché primero (más rápido)
print_info "Intentando rebuild con caché..."
if timeout 600 $DC build backend 2>&1 | tee /tmp/build-backend-solo.log | tail -20; then
    print_success "✅ Backend reconstruido con caché"
else
    print_warning "Build con caché falló, intentando sin caché..."
    if timeout 600 $DC build --no-cache backend 2>&1 | tee /tmp/build-backend-solo.log | tail -20; then
        print_success "✅ Backend reconstruido sin caché"
    else
        print_error "❌ Error al reconstruir backend"
        print_info "Ver log: /tmp/build-backend-solo.log"
        exit 1
    fi
fi

echo ""

# ============================================
# PASO 2: Reiniciar Backend
# ============================================
print_info "PASO 2: Reiniciando backend..."
echo ""

if $DC up -d backend; then
    print_success "Backend reiniciado correctamente"
else
    print_error "Error al reiniciar backend"
    exit 1
fi

echo ""

# ============================================
# PASO 3: Verificación
# ============================================
print_info "PASO 3: Verificando backend (esperando 10 segundos)..."
sleep 10
echo ""

# Backend
print_info "Verificando Backend..."
backend_ok=false
for i in {1..10}; do
    if curl -sf http://localhost:3001/health &>/dev/null; then
        print_success "Backend: OK"
        backend_ok=true
        break
    fi
    [ $i -lt 10 ] && echo "   Intento $i/10..." && sleep 2
done

if [ "$backend_ok" = false ]; then
    print_warning "Backend no responde aún"
    print_info "Ver logs: $DC logs backend --tail=50"
fi

echo ""

# Estado de contenedores
print_info "Estado de contenedores:"
$DC ps

echo ""

# ============================================
# RESUMEN FINAL
# ============================================
echo "=============================================="
print_success "¡ACTUALIZACIÓN DEL BACKEND COMPLETADA!"
echo "=============================================="
echo ""

print_info "✅ Backend reconstruido y reiniciado"
print_warning "⚠️  Frontend NO fue actualizado"
echo ""

echo "📍 URLs:"
echo "   • Backend API: http://localhost:3001"
echo ""

echo "📚 Para actualizar el frontend después:"
echo "   • Opción 1: Ejecuta: ./forzar-actualizacion-mejorado.sh"
echo "   • Opción 2: Ejecuta: docker compose build --no-cache frontend && docker compose up -d frontend"
echo ""

print_success "¡Listo!"
