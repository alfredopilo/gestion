#!/bin/bash

# Script de diagnóstico para problemas de actualización en VPS
# Ayuda a identificar por qué los cambios no se reflejan

echo "🔍 DIAGNÓSTICO DE ACTUALIZACIÓN - Gestión Escolar VPS"
echo "======================================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_section() { echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

# Detectar docker compose
if command -v docker-compose &> /dev/null; then
    DC="docker-compose"
else
    DC="docker compose"
fi

# ============================================
# 1. VERIFICAR ESTADO DE CONTENEDORES
# ============================================
print_section "1. Estado de Contenedores"
echo ""

if $DC ps | grep -q "Up"; then
    print_success "Contenedores están corriendo"
    $DC ps
else
    print_error "Contenedores NO están corriendo"
    $DC ps
    echo ""
    print_info "Solución: Ejecuta '$DC up -d'"
    exit 1
fi

echo ""

# ============================================
# 2. VERIFICAR IMÁGENES DOCKER
# ============================================
print_section "2. Información de Imágenes Docker"
echo ""

print_info "Imágenes actuales:"
docker images | grep -E "gestion-escolar|REPOSITORY" | head -10

echo ""
print_info "Fecha de creación de imágenes:"
backend_image=$(docker inspect gestion-escolar-backend --format='{{.Image}}' 2>/dev/null)
frontend_image=$(docker inspect gestion-escolar-frontend --format='{{.Image}}' 2>/dev/null)

if [ -n "$backend_image" ]; then
    backend_date=$(docker inspect $backend_image --format='{{.Created}}' 2>/dev/null | cut -d'T' -f1)
    print_info "Backend construido: $backend_date"
else
    print_error "No se pudo obtener info de imagen backend"
fi

if [ -n "$frontend_image" ]; then
    frontend_date=$(docker inspect $frontend_image --format='{{.Created}}' 2>/dev/null | cut -d'T' -f1)
    print_info "Frontend construido: $frontend_date"
else
    print_error "No se pudo obtener info de imagen frontend"
fi

echo ""

# ============================================
# 3. VERIFICAR VOLÚMENES (CÓDIGO)
# ============================================
print_section "3. Verificación de Volúmenes"
echo ""

backend_mounts=$(docker inspect gestion-escolar-backend --format='{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' 2>/dev/null)
frontend_mounts=$(docker inspect gestion-escolar-frontend --format='{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' 2>/dev/null)

if echo "$backend_mounts" | grep -q "/app"; then
    print_warning "Backend tiene volúmenes de código montados (modo desarrollo)"
    echo "$backend_mounts" | grep "/app"
else
    print_info "Backend SIN volúmenes de código (modo producción)"
    print_warning "Los cambios en archivos locales NO se reflejan automáticamente"
    print_info "➜ NECESITAS REBUILD para que los cambios se apliquen"
fi

echo ""

if echo "$frontend_mounts" | grep -q "/app\|/usr/share/nginx/html"; then
    print_warning "Frontend tiene volúmenes montados"
    echo "$frontend_mounts"
else
    print_info "Frontend usa build estático (Nginx)"
    print_warning "Los cambios en código NO se reflejan sin rebuild"
    print_info "➜ NECESITAS REBUILD del frontend para cambios visuales"
fi

echo ""

# ============================================
# 4. VERIFICAR ARCHIVOS RECIENTES
# ============================================
print_section "4. Archivos Modificados Recientemente"
echo ""

print_info "Últimos 10 archivos modificados en backend/src:"
find backend/src -type f -name "*.js" -o -name "*.json" 2>/dev/null | xargs ls -lt 2>/dev/null | head -10

echo ""
print_info "Últimos 10 archivos modificados en frontend/src:"
find frontend/src -type f -name "*.jsx" -o -name "*.js" 2>/dev/null | xargs ls -lt 2>/dev/null | head -10

echo ""

# ============================================
# 5. VERIFICAR VARIABLES DE ENTORNO
# ============================================
print_section "5. Variables de Entorno del Frontend"
echo ""

if [ -f ".env" ]; then
    print_success "Archivo .env encontrado en raíz"
    grep "VITE_API_URL" .env 2>/dev/null || print_warning "VITE_API_URL no definida en .env"
else
    print_warning "No se encontró archivo .env en la raíz"
fi

if [ -f "frontend/.env" ]; then
    print_success "Archivo .env encontrado en frontend/"
    grep "VITE_API_URL" frontend/.env 2>/dev/null || print_warning "VITE_API_URL no definida"
else
    print_warning "No se encontró archivo .env en frontend/"
fi

echo ""
print_info "VITE_API_URL usado en el build del contenedor:"
docker inspect gestion-escolar-frontend --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep VITE || print_warning "No se encontró VITE_API_URL en el contenedor"

echo ""

# ============================================
# 6. VERIFICAR SALUD DE SERVICIOS
# ============================================
print_section "6. Salud de Servicios"
echo ""

# PostgreSQL
print_info "PostgreSQL:"
if $DC exec -T postgres pg_isready -U gestionscolar &>/dev/null; then
    print_success "PostgreSQL: OK"
else
    print_error "PostgreSQL: ERROR"
fi

# Backend
print_info "Backend:"
if timeout 5 curl -sf http://localhost:3001/health &>/dev/null; then
    print_success "Backend responde en http://localhost:3001"
    curl -s http://localhost:3001/health | head -3
else
    print_error "Backend NO responde"
    print_info "Ver logs: $DC logs backend --tail=30"
fi

echo ""

# Frontend
print_info "Frontend:"
if timeout 5 curl -sf http://localhost &>/dev/null; then
    print_success "Frontend responde en http://localhost"
else
    print_error "Frontend NO responde"
    print_info "Ver logs: $DC logs frontend --tail=20"
fi

echo ""

# ============================================
# 7. ÚLTIMOS LOGS
# ============================================
print_section "7. Últimos Logs (Últimas 20 líneas)"
echo ""

print_info "Backend:"
$DC logs backend --tail=20 2>&1 | tail -15

echo ""
print_info "Frontend:"
$DC logs frontend --tail=15 2>&1 | tail -10

echo ""

# ============================================
# RESUMEN Y RECOMENDACIONES
# ============================================
print_section "RESUMEN Y RECOMENDACIONES"
echo ""

echo "📋 DIAGNÓSTICO:"
echo ""

# Verificar si necesita rebuild
NEEDS_REBUILD=false

if [ ! "$backend_mounts" ] && [ ! "$frontend_mounts" ]; then
    NEEDS_REBUILD=true
    print_warning "Tus contenedores están en MODO PRODUCCIÓN (sin volúmenes)"
    echo ""
    echo "   Esto significa que:"
    echo "   • Los cambios en archivos locales NO se sincronizan automáticamente"
    echo "   • DEBES hacer REBUILD de las imágenes para aplicar cambios"
    echo ""
fi

# Verificar edad de las imágenes
if [ -n "$backend_date" ] && [ -n "$frontend_date" ]; then
    print_info "Última construcción de imágenes: $backend_date"
    
    # Comparar con archivos modificados
    recent_backend=$(find backend/src -type f -mtime -1 2>/dev/null | wc -l)
    recent_frontend=$(find frontend/src -type f -mtime -1 2>/dev/null | wc -l)
    
    if [ "$recent_backend" -gt 0 ] || [ "$recent_frontend" -gt 0 ]; then
        print_warning "Hay archivos modificados recientemente que no están en las imágenes"
        echo ""
    fi
fi

echo "🔧 SOLUCIONES RECOMENDADAS:"
echo ""

echo "1️⃣  SI CAMBIASTE CÓDIGO (backend/src o frontend/src):"
echo "   → Ejecuta: ./vps-update.sh"
echo "   → Selecciona opción 2 (ACTUALIZACIÓN MEDIA con caché)"
echo "   → Tiempo: ~2-3 minutos"
echo ""

echo "2️⃣  SI CAMBIASTE DEPENDENCIAS (package.json):"
echo "   → Ejecuta: ./vps-update.sh"
echo "   → Selecciona opción 2 (ACTUALIZACIÓN MEDIA con caché)"
echo ""

echo "3️⃣  SI CAMBIASTE VARIABLES DE ENTORNO (.env):"
echo "   → Ejecuta: $DC down"
echo "   → Luego: $DC up -d --build"
echo ""

echo "4️⃣  SI HAY PROBLEMAS GRAVES O CACHÉ CORRUPTA:"
echo "   → Ejecuta: ./vps-update.sh"
echo "   → Selecciona opción 3 (ACTUALIZACIÓN COMPLETA sin caché)"
echo "   → Tiempo: ~5-10 minutos"
echo ""

echo "5️⃣  PARA APLICAR CAMBIOS INMEDIATAMENTE:"
echo "   → Opción A (Recomendada):"
echo "     $DC build --no-cache backend frontend"
echo "     $DC up -d"
echo ""
echo "   → Opción B (Solo backend si solo cambiaste backend):"
echo "     $DC build --no-cache backend"
echo "     $DC up -d backend"
echo ""

echo "📚 COMANDOS ÚTILES:"
echo "   • Ver logs en tiempo real:  $DC logs -f"
echo "   • Ver solo backend:         $DC logs -f backend"
echo "   • Ver solo frontend:        $DC logs -f frontend"
echo "   • Reiniciar servicios:      $DC restart"
echo "   • Ver uso de disco:         docker system df"
echo "   • Limpiar caché Docker:     docker system prune -a"
echo ""

print_info "TIP: Si los cambios aún no se reflejan después del rebuild:"
echo "   1. Limpia la caché del navegador (Ctrl+Shift+R o Cmd+Shift+R)"
echo "   2. Verifica que el archivo .env tenga la IP correcta del VPS"
echo "   3. Verifica los logs con: $DC logs -f"
echo ""

print_success "Diagnóstico completado"
