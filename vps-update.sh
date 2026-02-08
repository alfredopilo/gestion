#!/bin/bash

# Script de actualización OPTIMIZADO para VPS
# Diseñado específicamente para VPS con recursos limitados
# Usa caché de Docker de forma inteligente para actualizaciones más rápidas

set -e

echo "🚀 Actualización OPTIMIZADA para VPS - Gestión Escolar"
echo "======================================================="
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
print_step() { echo -e "${CYAN}▶️  $1${NC}"; }

# Detectar comando de Docker Compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    DOCKER_COMPOSE_CMD="docker compose"
fi

# ============================================
# DIAGNÓSTICO INICIAL
# ============================================
echo "🔍 Diagnóstico del sistema..."
echo ""

# Verificar espacio en disco
print_info "Verificando espacio en disco..."
disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 80 ]; then
    print_warning "Espacio en disco al ${disk_usage}% - Recomendado limpiar"
    print_info "Puedes limpiar con: docker system prune -a --volumes (¡CUIDADO! Borra imágenes no usadas)"
else
    print_success "Espacio en disco OK (${disk_usage}% usado)"
fi

# Verificar memoria disponible
print_info "Verificando memoria disponible..."
if command -v free &> /dev/null; then
    mem_free=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [ "$mem_free" -lt 500 ]; then
        print_warning "Memoria disponible baja (${mem_free}MB) - Build puede ser lento"
    else
        print_success "Memoria disponible OK (${mem_free}MB)"
    fi
fi

# Verificar contenedores en ejecución
print_info "Estado actual de contenedores..."
$DOCKER_COMPOSE_CMD ps

echo ""
echo "============================================"
echo ""

# ============================================
# PASO 1: Pull de cambios (opcional)
# ============================================
print_step "PASO 1: Actualizar código fuente"
echo ""

if [ -d ".git" ]; then
    read -p "¿Hacer pull de cambios desde git? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_info "Descargando cambios..."
        git pull || print_warning "Error al hacer pull, continuando..."
    fi
else
    print_info "No es repositorio git, saltando..."
fi

# ============================================
# PASO 2: Decidir estrategia de actualización
# ============================================
print_step "PASO 2: Estrategia de actualización"
echo ""

print_info "Selecciona el tipo de actualización:"
echo ""
echo "  1) RÁPIDA - Solo reiniciar servicios (30 segundos)"
echo "     Usar cuando: Solo cambiaste código JS/JSX sin cambios en dependencias"
echo ""
echo "  2) MEDIA - Rebuild con caché (2-3 minutos)"
echo "     Usar cuando: Cambiaste dependencias o Dockerfile"
echo ""
echo "  3) COMPLETA - Rebuild sin caché (5-10 minutos)"
echo "     Usar cuando: Hay problemas graves o corrupción de caché"
echo ""
echo "  4) SOLO BACKEND - Rebuild solo backend con caché (1-2 minutos)"
echo ""
echo "  5) DIAGNÓSTICO - Ver logs y estado sin cambios"
echo ""
read -p "Opción (1/2/3/4/5): " -n 1 -r UPDATE_TYPE
echo
echo ""

# ============================================
# EJECUCIÓN SEGÚN TIPO
# ============================================

case $UPDATE_TYPE in
    1)
        # ============================================
        # ACTUALIZACIÓN RÁPIDA
        # ============================================
        print_info "Actualización RÁPIDA seleccionada"
        echo ""
        
        print_info "Copiando código fuente al contenedor backend..."
        $DOCKER_COMPOSE_CMD exec -T backend rm -rf /app/src 2>/dev/null || true
        docker cp backend/src/. gestion-escolar-backend:/app/src/ 2>&1 | grep -v "deprecated" || {
            print_warning "Error al copiar archivos, intentando alternativa..."
            $DOCKER_COMPOSE_CMD restart backend
        }
        
        print_info "Copiando código fuente al contenedor frontend..."
        docker cp frontend/src/. gestion-escolar-frontend:/app/src/ 2>&1 | grep -v "deprecated" || {
            print_warning "Frontend usa build estático, necesitas rebuild"
            print_info "Ejecuta opción 2 o 4 para actualizar frontend"
        }
        
        print_info "Reiniciando backend..."
        $DOCKER_COMPOSE_CMD restart backend
        
        print_success "Actualización rápida completada"
        ;;
        
    2)
        # ============================================
        # ACTUALIZACIÓN MEDIA (CON CACHÉ)
        # ============================================
        print_info "Actualización MEDIA seleccionada (con caché)"
        echo ""
        
        # Habilitar BuildKit para builds más rápidos
        export DOCKER_BUILDKIT=1
        export COMPOSE_DOCKER_CLI_BUILD=1
        
        print_info "Reconstruyendo BACKEND con caché..."
        print_info "Esto tomará 1-3 minutos dependiendo de tu VPS..."
        
        # Build con timeout y manejo de errores
        if timeout 600 $DOCKER_COMPOSE_CMD build backend 2>&1 | tee /tmp/build-backend.log | grep -E "(Step|CACHED|DONE|ERROR|=>)" | tail -30; then
            print_success "Backend reconstruido correctamente"
        else
            print_error "Error o timeout en build de backend"
            print_info "Ver log completo en: /tmp/build-backend.log"
            read -p "¿Continuar de todos modos? (s/n): " -n 1 -r
            echo
            [[ ! $REPLY =~ ^[Ss]$ ]] && exit 1
        fi
        
        print_info "Reconstruyendo FRONTEND con caché..."
        print_info "Esto tomará 1-2 minutos..."
        
        if timeout 400 $DOCKER_COMPOSE_CMD build frontend 2>&1 | tee /tmp/build-frontend.log | grep -E "(Step|CACHED|DONE|ERROR|=>)" | tail -30; then
            print_success "Frontend reconstruido correctamente"
        else
            print_error "Error o timeout en build de frontend"
            print_info "Ver log completo en: /tmp/build-frontend.log"
        fi
        
        print_info "Reiniciando servicios..."
        $DOCKER_COMPOSE_CMD up -d
        
        print_success "Actualización media completada"
        ;;
        
    3)
        # ============================================
        # ACTUALIZACIÓN COMPLETA (SIN CACHÉ)
        # ============================================
        print_error "⚠️  ADVERTENCIA: Actualización COMPLETA sin caché"
        print_warning "Esto puede tardar 5-10 minutos en VPS con recursos limitados"
        read -p "¿Estás seguro? (s/n): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Ss]$ ]] && exit 0
        
        echo ""
        export DOCKER_BUILDKIT=1
        export COMPOSE_DOCKER_CLI_BUILD=1
        
        print_info "Reconstruyendo BACKEND sin caché..."
        print_warning "Esto puede tardar 5-8 minutos - NO INTERRUMPAS EL PROCESO"
        
        if timeout 900 $DOCKER_COMPOSE_CMD build --no-cache --progress=plain backend 2>&1 | tee /tmp/build-backend-nocache.log | grep -E "(Step|RUN|COPY|FROM|ERROR|=>)" | tail -40; then
            print_success "Backend reconstruido sin caché"
        else
            print_error "Error o timeout (15 min) en build de backend"
            print_info "Ver log completo en: /tmp/build-backend-nocache.log"
            exit 1
        fi
        
        print_info "Reconstruyendo FRONTEND sin caché..."
        print_warning "Esto puede tardar 3-5 minutos..."
        
        if timeout 600 $DOCKER_COMPOSE_CMD build --no-cache --progress=plain frontend 2>&1 | tee /tmp/build-frontend-nocache.log | grep -E "(Step|RUN|COPY|FROM|ERROR|=>)" | tail -40; then
            print_success "Frontend reconstruido sin caché"
        else
            print_error "Error o timeout en build de frontend"
        fi
        
        print_info "Reiniciando servicios..."
        $DOCKER_COMPOSE_CMD up -d
        
        print_success "Actualización completa sin caché finalizada"
        ;;
        
    4)
        # ============================================
        # SOLO BACKEND
        # ============================================
        print_info "Actualización SOLO BACKEND seleccionada"
        echo ""
        
        export DOCKER_BUILDKIT=1
        
        print_info "Reconstruyendo BACKEND con caché..."
        if timeout 600 $DOCKER_COMPOSE_CMD build backend 2>&1 | grep -E "(Step|CACHED|DONE|ERROR)" | tail -20; then
            print_success "Backend reconstruido"
        else
            print_error "Error en build de backend"
            exit 1
        fi
        
        print_info "Reiniciando backend..."
        $DOCKER_COMPOSE_CMD up -d backend
        
        print_success "Backend actualizado"
        ;;
        
    5)
        # ============================================
        # DIAGNÓSTICO
        # ============================================
        print_info "DIAGNÓSTICO DEL SISTEMA"
        echo ""
        
        print_info "Estado de contenedores:"
        $DOCKER_COMPOSE_CMD ps
        echo ""
        
        print_info "Imágenes de Docker:"
        docker images | grep -E "gestion-escolar|REPOSITORY"
        echo ""
        
        print_info "Uso de espacio Docker:"
        docker system df
        echo ""
        
        print_info "Últimos 30 logs del BACKEND:"
        $DOCKER_COMPOSE_CMD logs backend --tail=30
        echo ""
        
        print_info "Últimos 20 logs del FRONTEND:"
        $DOCKER_COMPOSE_CMD logs frontend --tail=20
        echo ""
        
        print_info "Verificando salud de PostgreSQL:"
        $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U gestionscolar
        echo ""
        
        print_info "Estado de migraciones de Prisma:"
        $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1 || print_warning "Error al verificar migraciones"
        echo ""
        
        print_success "Diagnóstico completado"
        exit 0
        ;;
        
    *)
        print_error "Opción inválida"
        exit 1
        ;;
esac

# ============================================
# PASO 2.5: Aplicar migraciones (opciones 1-4)
# Asegura que Prisma Client y migraciones pendientes se apliquen tras cualquier actualización
# ============================================
if [ "$UPDATE_TYPE" = "1" ] || [ "$UPDATE_TYPE" = "2" ] || [ "$UPDATE_TYPE" = "3" ] || [ "$UPDATE_TYPE" = "4" ]; then
    echo ""
    print_step "PASO 2.5: Aplicando migraciones de base de datos..."
    echo ""
    
    print_info "Esperando a que el backend esté listo..."
    sleep 5
    for i in 1 2 3 4 5 6 7 8 9 10; do
        if $DOCKER_COMPOSE_CMD exec -T backend sh -c "exit 0" 2>/dev/null; then
            print_success "Backend listo"
            break
        fi
        [ $i -lt 10 ] && echo "   Intento $i/10..." && sleep 2
    done
    
    print_info "Regenerando Prisma Client..."
    if $DOCKER_COMPOSE_CMD exec -T backend npx prisma generate 2>&1 | tail -3; then
        print_success "Prisma Client generado"
    else
        print_warning "Error al generar Prisma Client (puede que ya esté actualizado)"
    fi
    
    print_info "Aplicando migraciones pendientes..."
    migration_out=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy 2>&1)
    if echo "$migration_out" | grep -qE "No pending|already applied|Database schema is up to date|Applied the following|migrations have been applied"; then
        print_success "Migraciones aplicadas o ya al día"
    elif echo "$migration_out" | grep -q "Error\|P3009\|failed"; then
        print_warning "Hubo un problema con las migraciones. Revisa: $DOCKER_COMPOSE_CMD exec backend npx prisma migrate status"
        echo "$migration_out" | tail -5
    else
        print_success "Migraciones ejecutadas"
    fi
    echo ""
fi

# ============================================
# PASO 3: Verificación post-actualización
# ============================================
echo ""
print_step "PASO 3: Verificando servicios..."
echo ""

print_info "Esperando a que los servicios estén listos..."
sleep 5

# Verificar PostgreSQL
print_info "Verificando PostgreSQL..."
if $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U gestionscolar &> /dev/null; then
    print_success "PostgreSQL: OK"
else
    print_error "PostgreSQL: ERROR"
fi

# Verificar Backend
print_info "Verificando Backend (puede tardar ~15 segundos)..."
backend_ok=false
for i in {1..15}; do
    if curl -sf http://localhost:3001/health &> /dev/null; then
        print_success "Backend: OK"
        backend_ok=true
        break
    fi
    [ $i -lt 15 ] && echo "   Intento $i/15..." && sleep 2
done

if [ "$backend_ok" = false ]; then
    print_warning "Backend no responde aún"
    print_info "Ver logs: docker compose logs backend --tail=50"
fi

# Verificar Frontend
print_info "Verificando Frontend..."
if curl -sf http://localhost &> /dev/null; then
    print_success "Frontend: OK"
else
    print_warning "Frontend no responde aún (puede tardar más)"
fi

# ============================================
# PASO 4: Estado final
# ============================================
echo ""
print_step "PASO 4: Estado final del sistema"
echo ""

$DOCKER_COMPOSE_CMD ps

# ============================================
# RESUMEN FINAL
# ============================================
echo ""
echo "=============================================="
print_success "¡Actualización completada!"
echo "=============================================="
echo ""
echo "📍 URLs de acceso:"
echo "   • Frontend:     http://localhost (o http://tu-ip-vps)"
echo "   • Backend API:  http://localhost:3001"
echo ""
echo "📚 Comandos útiles:"
echo "   • Ver logs:           docker compose logs -f"
echo "   • Ver logs backend:   docker compose logs -f backend"
echo "   • Reiniciar todo:     docker compose restart"
echo "   • Reiniciar backend:  docker compose restart backend"
echo "   • Ver uso de disco:   docker system df"
echo ""
echo "🔧 Si hay problemas:"
echo "   • Ejecuta opción 5 (Diagnóstico) para ver detalles"
echo "   • Logs completos backend: /tmp/build-backend.log"
echo "   • Logs completos frontend: /tmp/build-frontend.log"
echo ""
echo "💡 Recomendaciones VPS:"
echo "   • Usa actualización RÁPIDA (1) para cambios de código"
echo "   • Usa actualización MEDIA (2) cuando cambies dependencias"
echo "   • Evita actualización COMPLETA (3) a menos que sea necesario"
echo "   • Limpia Docker periódicamente: docker system prune"
echo ""
