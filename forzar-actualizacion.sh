#!/bin/bash

# Script para FORZAR actualización cuando los cambios no se reflejan
# Rebuild completo sin caché + limpieza

set -e

echo "⚡ FORZAR ACTUALIZACIÓN - Sistema de Gestión Escolar"
echo "====================================================="
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

print_warning "Este script hará un REBUILD COMPLETO forzado de las imágenes"
print_warning "Esto garantiza que TODOS los cambios se apliquen"
echo ""
print_info "Tiempo estimado: 3-5 minutos"
echo ""

read -p "¿Continuar? (s/n): " -n 1 -r
echo
[[ ! $REPLY =~ ^[Ss]$ ]] && exit 0

echo ""

# ============================================
# PASO 1: Detener contenedores
# ============================================
print_info "PASO 1: Deteniendo contenedores..."
$DC down

print_success "Contenedores detenidos"
echo ""

# ============================================
# PASO 2: Eliminar imágenes antiguas (opcional)
# ============================================
print_info "PASO 2: ¿Eliminar imágenes antiguas?"
echo ""
print_warning "Esto asegura una reconstrucción completamente limpia"
print_info "Recomendado si has tenido problemas persistentes"
echo ""

read -p "¿Eliminar imágenes antiguas? (s/n): " -n 1 -r
echo
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_info "Eliminando imágenes antiguas..."
    
    docker rmi gestion-escolar-backend 2>/dev/null && print_success "Imagen backend eliminada" || print_info "Imagen backend no encontrada"
    docker rmi gestion-escolar-frontend 2>/dev/null && print_success "Imagen frontend eliminada" || print_info "Imagen frontend no encontrada"
    
    # También eliminar imágenes con el nombre del proyecto
    docker images | grep gestionescolar | awk '{print $3}' | xargs -r docker rmi 2>/dev/null || true
    
    print_success "Limpieza completada"
else
    print_info "Saltando eliminación de imágenes"
fi

echo ""

# ============================================
# PASO 3: Verificar archivo .env
# ============================================
print_info "PASO 3: Verificando configuración..."
echo ""

# Buscar archivo .env
if [ -f ".env" ]; then
    print_success "Archivo .env encontrado en raíz"
    
    if grep -q "VITE_API_URL" .env; then
        API_URL=$(grep "VITE_API_URL" .env | cut -d'=' -f2)
        print_info "VITE_API_URL configurado: $API_URL"
        
        if echo "$API_URL" | grep -q "localhost"; then
            print_warning "¡ADVERTENCIA! Estás usando localhost en VITE_API_URL"
            print_warning "Si estás en un VPS, debes usar la IP del VPS, no localhost"
            echo ""
            print_info "Ejemplo correcto:"
            print_info "VITE_API_URL=http://TU_IP_VPS:3001/api/v1"
            echo ""
            
            read -p "¿Deseas continuar de todos modos? (s/n): " -n 1 -r
            echo
            [[ ! $REPLY =~ ^[Ss]$ ]] && exit 0
        fi
    else
        print_warning "VITE_API_URL no encontrado en .env"
        print_info "Se usará el valor por defecto: http://localhost:3001/api/v1"
    fi
else
    print_warning "No se encontró archivo .env"
    print_info "Se usará configuración por defecto"
    print_info "Para configurar la API URL, crea un archivo .env con:"
    echo ""
    echo "VITE_API_URL=http://TU_IP_VPS:3001/api/v1"
    echo ""
    
    read -p "¿Continuar sin .env? (s/n): " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Ss]$ ]] && exit 0
fi

echo ""

# ============================================
# PASO 4: Rebuild FORZADO (sin caché)
# ============================================
print_info "PASO 4: Reconstruyendo imágenes SIN caché..."
echo ""

# Habilitar BuildKit para builds más rápidos
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

print_warning "Backend: Reconstruyendo... (esto puede tardar 2-3 minutos)"
echo ""

# Backend
if timeout 600 $DC build --no-cache --progress=plain backend 2>&1 | tee /tmp/build-backend-forzado.log | grep -E "(Step|RUN|COPY|CACHED|DONE|ERROR|=>)" | tail -40; then
    print_success "✅ Backend reconstruido correctamente"
else
    print_error "❌ Error al reconstruir backend"
    print_info "Ver log completo en: /tmp/build-backend-forzado.log"
    
    read -p "¿Continuar con frontend de todos modos? (s/n): " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Ss]$ ]] && exit 1
fi

echo ""
print_warning "Frontend: Reconstruyendo... (esto puede tardar 2-3 minutos)"
echo ""

# Frontend
if timeout 600 $DC build --no-cache --progress=plain frontend 2>&1 | tee /tmp/build-frontend-forzado.log | grep -E "(Step|RUN|COPY|CACHED|DONE|ERROR|=>)" | tail -40; then
    print_success "✅ Frontend reconstruido correctamente"
else
    print_error "❌ Error al reconstruir frontend"
    print_info "Ver log completo en: /tmp/build-frontend-forzado.log"
    
    read -p "¿Continuar de todos modos? (s/n): " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Ss]$ ]] && exit 1
fi

echo ""

# ============================================
# PASO 5: Iniciar servicios
# ============================================
print_info "PASO 5: Iniciando servicios..."
echo ""

if $DC up -d; then
    print_success "Servicios iniciados correctamente"
else
    print_error "Error al iniciar servicios"
    print_info "Verifica logs con: $DC logs"
    exit 1
fi

echo ""

# ============================================
# PASO 6: Verificación
# ============================================
print_info "PASO 6: Verificando servicios (esperando 10 segundos)..."
sleep 10
echo ""

# PostgreSQL
print_info "Verificando PostgreSQL..."
if $DC exec -T postgres pg_isready -U gestionscolar &>/dev/null; then
    print_success "PostgreSQL: OK"
else
    print_error "PostgreSQL: ERROR"
fi

# Backend
print_info "Verificando Backend..."
backend_ok=false
for i in {1..10}; do
    if curl -sf http://localhost:3001/health &>/dev/null; then
        print_success "Backend: OK"
        backend_ok=true
        break
    fi
    [ $i -lt 10 ] && sleep 2
done

if [ "$backend_ok" = false ]; then
    print_warning "Backend no responde aún"
    print_info "Ver logs: $DC logs backend --tail=50"
fi

# Frontend
print_info "Verificando Frontend..."
if curl -sf http://localhost &>/dev/null; then
    print_success "Frontend: OK"
else
    print_warning "Frontend no responde aún"
    print_info "Ver logs: $DC logs frontend --tail=30"
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
print_success "¡ACTUALIZACIÓN FORZADA COMPLETADA!"
echo "=============================================="
echo ""

print_info "✅ Imágenes reconstruidas sin caché"
print_info "✅ Todos los cambios deberían estar aplicados"
echo ""

echo "📍 Accede a tu aplicación:"
echo "   • Frontend:    http://localhost (o http://TU_IP_VPS)"
echo "   • Backend API: http://localhost:3001"
echo ""

echo "🔍 Si los cambios AÚN no se reflejan:"
echo ""
echo "   1. Limpia la caché del navegador:"
echo "      • Chrome/Edge: Ctrl+Shift+R (Windows) o Cmd+Shift+R (Mac)"
echo "      • Firefox: Ctrl+F5 (Windows) o Cmd+Shift+R (Mac)"
echo ""
echo "   2. Verifica los logs:"
echo "      $DC logs -f backend"
echo "      $DC logs -f frontend"
echo ""
echo "   3. Verifica que el .env tenga la IP correcta del VPS"
echo ""
echo "   4. Si el problema persiste, ejecuta:"
echo "      ./diagnostico-vps.sh"
echo ""

echo "📚 Logs guardados en:"
echo "   • Backend:  /tmp/build-backend-forzado.log"
echo "   • Frontend: /tmp/build-frontend-forzado.log"
echo ""

print_success "¡Todo listo!"
