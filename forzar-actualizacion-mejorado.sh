#!/bin/bash

# Script MEJORADO para FORZAR actualización cuando los cambios no se reflejan
# Versión optimizada para VPS con recursos limitados
# Incluye mejor manejo de timeouts, progreso visible y opción de continuar build colgado

set -e

echo "⚡ FORZAR ACTUALIZACIÓN MEJORADO - Sistema de Gestión Escolar"
echo "=============================================================="
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
print_progress() { echo -e "${CYAN}🔄 $1${NC}"; }

# Detectar docker compose
if command -v docker-compose &> /dev/null; then
    DC="docker-compose"
else
    DC="docker compose"
fi

print_warning "Este script hará un REBUILD COMPLETO forzado de las imágenes"
print_warning "Versión optimizada para VPS con recursos limitados"
echo ""
print_info "El build del frontend puede tardar 5-15 minutos en VPS con poca RAM"
print_info "El progreso se mostrará en tiempo real"
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
read -p "¿Eliminar imágenes antiguas? (s/n): " -n 1 -r
echo
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_info "Eliminando imágenes antiguas..."
    docker rmi gestion-escolar-backend 2>/dev/null && print_success "Imagen backend eliminada" || print_info "Imagen backend no encontrada"
    docker rmi gestion-escolar-frontend 2>/dev/null && print_success "Imagen frontend eliminada" || print_info "Imagen frontend no encontrada"
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

if [ -f ".env" ]; then
    print_success "Archivo .env encontrado en raíz"
    if grep -q "VITE_API_URL" .env; then
        API_URL=$(grep "VITE_API_URL" .env | cut -d'=' -f2)
        print_info "VITE_API_URL configurado: $API_URL"
        if echo "$API_URL" | grep -q "localhost"; then
            print_warning "¡ADVERTENCIA! Estás usando localhost en VITE_API_URL"
            print_warning "Si estás en un VPS, debes usar la IP del VPS"
        fi
    fi
else
    print_warning "No se encontró archivo .env"
fi

echo ""

# ============================================
# PASO 4: Rebuild FORZADO (MEJORADO)
# ============================================
print_info "PASO 4: Reconstruyendo imágenes SIN caché..."
echo ""

# Habilitar BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# ============================================
# BACKEND
# ============================================
print_warning "Backend: Reconstruyendo... (esto puede tardar 2-5 minutos)"
print_info "Progreso se guardará en: /tmp/build-backend-forzado.log"
echo ""

# Build del backend en background con mejor manejo de salida
(
    $DC build --no-cache --progress=plain backend 2>&1 | tee /tmp/build-backend-forzado.log
    echo "BACKEND_BUILD_EXIT_CODE=$?" > /tmp/build-backend-status.log
) &
BACKEND_PID=$!

# Mostrar progreso del backend en tiempo real
print_progress "PID del proceso backend: $BACKEND_PID"
print_info "Puedes monitorear el progreso en otra terminal con:"
print_info "  tail -f /tmp/build-backend-forzado.log"
echo ""

# Esperar con timeout de 15 minutos y mostrar progreso cada 30 segundos
BACKEND_TIMEOUT=900  # 15 minutos
ELAPSED=0
while kill -0 $BACKEND_PID 2>/dev/null; do
    if [ $ELAPSED -ge $BACKEND_TIMEOUT ]; then
        print_error "Backend: Timeout después de 15 minutos"
        kill $BACKEND_PID 2>/dev/null || true
        read -p "¿Continuar esperando? (s/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            BACKEND_TIMEOUT=$((BACKEND_TIMEOUT + 300))  # Agregar 5 minutos más
        else
            exit 1
        fi
    fi
    
    # Mostrar progreso cada 30 segundos
    if [ $((ELAPSED % 30)) -eq 0 ] && [ $ELAPSED -gt 0 ]; then
        print_progress "Backend: Todavía construyendo... (${ELAPSED}s transcurridos)"
        # Mostrar últimas líneas del log
        tail -3 /tmp/build-backend-forzado.log 2>/dev/null | grep -E "(Step|RUN|COPY|DONE|ERROR|=>)" | tail -2 || true
    fi
    
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

# Esperar a que termine completamente
wait $BACKEND_PID
BACKEND_EXIT_CODE=$?

# Verificar resultado
if [ -f /tmp/build-backend-status.log ]; then
    source /tmp/build-backend-status.log
    BACKEND_EXIT_CODE=$BACKEND_BUILD_EXIT_CODE
fi

if [ $BACKEND_EXIT_CODE -eq 0 ]; then
    print_success "✅ Backend reconstruido correctamente"
    print_info "Tiempo total: ~$((ELAPSED / 60)) minutos"
else
    print_error "❌ Error al reconstruir backend"
    print_info "Ver log completo en: /tmp/build-backend-forzado.log"
    print_info "Últimas 20 líneas del log:"
    tail -20 /tmp/build-backend-forzado.log | grep -v "^$" | tail -10
    echo ""
    read -p "¿Continuar con frontend de todos modos? (s/n): " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Ss]$ ]] && exit 1
fi

echo ""

# ============================================
# FRONTEND (CON MEJORES INDICADORES)
# ============================================
print_warning "Frontend: Reconstruyendo... (esto puede tardar 5-15 minutos en VPS lento)"
print_warning "⚠️  IMPORTANTE: NO CANCELES ESTE PROCESO, puede tardar mucho tiempo"
print_info "Progreso se guardará en: /tmp/build-frontend-forzado.log"
echo ""
print_info "El build del frontend es más pesado porque incluye:"
print_info "  • Instalación de dependencias de React/Vite"
print_info "  • Compilación de todo el código JavaScript/JSX"
print_info "  • Optimización y minificación de assets"
echo ""

# Build del frontend en background
(
    $DC build --no-cache --progress=plain frontend 2>&1 | tee /tmp/build-frontend-forzado.log
    echo "FRONTEND_BUILD_EXIT_CODE=$?" > /tmp/build-frontend-status.log
) &
FRONTEND_PID=$!

print_progress "PID del proceso frontend: $FRONTEND_PID"
print_info "Puedes monitorear el progreso en otra terminal con:"
print_info "  tail -f /tmp/build-frontend-forzado.log"
echo ""
print_info "TIP: Si quieres ver el progreso completo, abre otra terminal y ejecuta:"
print_info "  watch -n 5 'tail -10 /tmp/build-frontend-forzado.log'"
echo ""

# Esperar con timeout de 30 minutos y mostrar progreso cada 60 segundos
FRONTEND_TIMEOUT=1800  # 30 minutos
ELAPSED=0
LAST_LOG_SIZE=0

while kill -0 $FRONTEND_PID 2>/dev/null; do
    if [ $ELAPSED -ge $FRONTEND_TIMEOUT ]; then
        print_error "Frontend: Timeout después de 30 minutos"
        print_info "Verificando si el proceso sigue activo..."
        
        # Verificar si el log sigue creciendo (signo de que está trabajando)
        CURRENT_LOG_SIZE=$(stat -f%z /tmp/build-frontend-forzado.log 2>/dev/null || stat -c%s /tmp/build-frontend-forzado.log 2>/dev/null || echo 0)
        if [ "$CURRENT_LOG_SIZE" -gt "$LAST_LOG_SIZE" ]; then
            print_info "El build parece estar activo (log sigue creciendo)"
            print_info "Extendiendo timeout otros 10 minutos..."
            FRONTEND_TIMEOUT=$((FRONTEND_TIMEOUT + 600))
        else
            print_warning "El build parece estar colgado (log no crece)"
            print_info "Últimas líneas del log:"
            tail -10 /tmp/build-frontend-forzado.log
            echo ""
            read -p "¿Matar el proceso y reintentar? (s/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Ss]$ ]]; then
                kill $FRONTEND_PID 2>/dev/null || true
                exit 1
            else
                FRONTEND_TIMEOUT=$((FRONTEND_TIMEOUT + 600))  # Extender otros 10 minutos
            fi
        fi
        LAST_LOG_SIZE=$CURRENT_LOG_SIZE
    fi
    
    # Mostrar progreso cada 60 segundos con información útil
    if [ $((ELAPSED % 60)) -eq 0 ] && [ $ELAPSED -gt 0 ]; then
        MINUTES=$((ELAPSED / 60))
        print_progress "Frontend: Todavía construyendo... (${MINUTES} min transcurridos)"
        
        # Mostrar últimas líneas relevantes del log
        LAST_LINES=$(tail -5 /tmp/build-frontend-forzado.log 2>/dev/null | grep -E "(Step|RUN|COPY|DONE|ERROR|=>|npm|vite|build)" | tail -2)
        if [ -n "$LAST_LINES" ]; then
            echo "$LAST_LINES" | while read line; do
                print_info "  → $line"
            done
        fi
        
        # Mostrar uso de recursos
        if command -v free &> /dev/null; then
            MEM_FREE=$(free -m | awk 'NR==2{printf "%.0f", $7}')
            print_info "  Memoria disponible: ${MEM_FREE}MB"
        fi
        echo ""
    fi
    
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    
    # Actualizar tamaño del log para detectar si está colgado
    if [ $((ELAPSED % 30)) -eq 0 ]; then
        CURRENT_LOG_SIZE=$(stat -f%z /tmp/build-frontend-forzado.log 2>/dev/null || stat -c%s /tmp/build-frontend-forzado.log 2>/dev/null || echo 0)
        LAST_LOG_SIZE=$CURRENT_LOG_SIZE
    fi
done

# Esperar a que termine completamente
wait $FRONTEND_PID
FRONTEND_EXIT_CODE=$?

# Verificar resultado
if [ -f /tmp/build-frontend-status.log ]; then
    source /tmp/build-frontend-status.log
    FRONTEND_EXIT_CODE=$FRONTEND_BUILD_EXIT_CODE
fi

if [ $FRONTEND_EXIT_CODE -eq 0 ]; then
    print_success "✅ Frontend reconstruido correctamente"
    print_info "Tiempo total: ~$((ELAPSED / 60)) minutos"
else
    print_error "❌ Error al reconstruir frontend"
    print_info "Ver log completo en: /tmp/build-frontend-forzado.log"
    print_info "Últimas 30 líneas del log:"
    tail -30 /tmp/build-frontend-forzado.log | grep -v "^$" | tail -20
    echo ""
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

echo "📚 Logs guardados en:"
echo "   • Backend:  /tmp/build-backend-forzado.log"
echo "   • Frontend: /tmp/build-frontend-forzado.log"
echo ""

print_success "¡Todo listo!"
