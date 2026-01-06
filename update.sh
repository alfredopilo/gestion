#!/bin/bash

# Script de actualización para Sistema de Gestión Escolar
# Aplica cambios, migraciones y actualiza contenedores

set -e  # Salir si hay algún error

echo "🔄 Actualización del Sistema de Gestión Escolar"
echo "=============================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de impresión
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Detectar comando de Docker Compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    DOCKER_COMPOSE_CMD="docker compose"
fi

# ============================================
# PASO 1: Pull de cambios (si es un repositorio git)
# ============================================
echo "📋 PASO 1: Verificando cambios..."
echo ""

if [ -d ".git" ]; then
    print_info "Detectado repositorio Git"
    read -p "¿Deseas hacer pull de los últimos cambios? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_info "Haciendo pull de cambios..."
        git pull || print_warning "Error al hacer pull, continuando de todos modos..."
        print_success "Cambios actualizados desde repositorio"
    fi
else
    print_info "No es un repositorio Git, saltando paso de pull"
fi

# ============================================
# PASO 2: Backup de base de datos (opcional)
# ============================================
echo ""
echo "📋 PASO 2: Backup de base de datos..."
echo ""

read -p "¿Deseas hacer un backup de la base de datos antes de actualizar? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_info "Creando backup de base de datos..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    $DOCKER_COMPOSE_CMD exec -T postgres pg_dump -U gestionscolar gestion_escolar > "backup_${timestamp}.sql" 2>/dev/null || {
        print_warning "Error al crear backup, continuando..."
    }
    if [ -f "backup_${timestamp}.sql" ]; then
        print_success "Backup creado: backup_${timestamp}.sql"
    fi
fi

# ============================================
# PASO 3: Instalar dependencias backend
# ============================================
echo ""
echo "📋 PASO 3: Actualizando dependencias backend..."
echo ""

print_info "Instalando dependencias del backend..."
if $DOCKER_COMPOSE_CMD exec -T backend npm install 2>&1 | grep -v "npm WARN"; then
    print_success "Dependencias del backend actualizadas"
else
    print_warning "Puede haber advertencias en las dependencias, continuando..."
fi

# ============================================
# PASO 4: Generar Prisma Client
# ============================================
echo ""
echo "📋 PASO 4: Regenerando Prisma Client..."
echo ""

print_info "Generando Prisma Client..."
if $DOCKER_COMPOSE_CMD exec -T backend npx prisma generate; then
    print_success "Prisma Client regenerado"
else
    print_error "Error al regenerar Prisma Client"
    exit 1
fi

# ============================================
# PASO 5: Ejecutar migraciones pendientes
# ============================================
echo ""
echo "📋 PASO 5: Aplicando migraciones de base de datos..."
echo ""

print_info "Verificando migraciones pendientes..."
migration_status=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1)

if echo "$migration_status" | grep -q "Database schema is up to date"; then
    print_success "No hay migraciones pendientes"
elif echo "$migration_status" | grep -q "following migrations have not yet been applied"; then
    print_info "Hay migraciones pendientes, aplicando..."
    if $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy; then
        print_success "Migraciones aplicadas correctamente"
    else
        print_error "Error al aplicar migraciones"
        print_info "Verifica los logs con: $DOCKER_COMPOSE_CMD logs backend"
        exit 1
    fi
else
    print_warning "Estado de migraciones indeterminado, intentando aplicar..."
    $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy || {
        print_warning "Puede haber un problema con las migraciones"
    }
fi

# ============================================
# PASO 6: Ejecutar Script SQL para access_logs
# ============================================
echo ""
echo "📋 PASO 6: Verificando tabla access_logs..."
echo ""

if [ -f "create_access_logs_table.sql" ]; then
    print_info "Verificando/creando tabla access_logs..."
    $DOCKER_COMPOSE_CMD cp create_access_logs_table.sql backend:/tmp/create_access_logs_table.sql
    if $DOCKER_COMPOSE_CMD exec -T backend psql postgresql://gestionscolar:gestionscolar2024@postgres:5432/gestion_escolar -f /tmp/create_access_logs_table.sql 2>&1 | grep -q "CREATE TABLE\|already exists"; then
        print_success "Tabla access_logs verificada/creada"
    else
        print_warning "La tabla access_logs puede ya existir o hubo un error menor"
    fi
else
    print_info "Script de access_logs no encontrado, puede que ya esté aplicado"
fi

# ============================================
# PASO 7: Seed de permisos (idempotente)
# ============================================
echo ""
echo "📋 PASO 7: Actualizando permisos..."
echo ""

print_info "Verificando que el backend esté listo..."
max_attempts=20
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if $DOCKER_COMPOSE_CMD exec -T backend sh -c "exit 0" &> /dev/null; then
        print_success "Backend está listo"
        break
    fi
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        print_error "Backend no respondió a tiempo"
        exit 1
    fi
    sleep 2
done

print_info "Ejecutando seed de permisos..."
seed_output=$($DOCKER_COMPOSE_CMD exec -T backend node prisma/seed-permissions.js 2>&1)
if echo "$seed_output" | grep -q "Seed completado\|✅"; then
    print_success "Permisos actualizados correctamente"
elif echo "$seed_output" | grep -q "already exists"; then
    print_success "Permisos ya existen (normal)"
else
    print_warning "Verificar manualmente los permisos"
    echo "$seed_output" | tail -5
fi

# ============================================
# PASO 8: Instalar dependencias frontend
# ============================================
echo ""
echo "📋 PASO 8: Actualizando dependencias frontend..."
echo ""

print_info "Instalando dependencias del frontend..."
if $DOCKER_COMPOSE_CMD exec -T frontend npm install 2>&1 | grep -v "npm WARN"; then
    print_success "Dependencias del frontend actualizadas"
else
    print_warning "Puede haber advertencias en las dependencias, continuando..."
fi

# ============================================
# PASO 9: Reconstruir y reiniciar contenedores (OPTIMIZADO)
# ============================================
echo ""
echo "📋 PASO 9: Reconstruyendo contenedores..."
echo ""

# Preguntar si se desea reconstruir
print_info "¿Deseas reconstruir las imágenes? Esto puede tardar varios minutos. (s/n)"
read -r rebuild_response

if [[ "$rebuild_response" =~ ^[Ss]$ ]]; then
    print_info "Reconstruyendo imágenes (esto puede tardar varios minutos)..."
    print_info "Usando DOCKER_BUILDKIT para acelerar el proceso..."
    
    # Usar DOCKER_BUILDKIT para builds más rápidos y sin provenance
    export DOCKER_BUILDKIT=1
    export BUILDKIT_PROGRESS=plain
    
    # Build con timeout implícito y sin provenance (más rápido)
    print_info "Construyendo backend..."
    if timeout 600 $DOCKER_COMPOSE_CMD build --progress=plain --no-cache backend 2>&1 | tee /tmp/build-backend.log; then
        print_success "Backend reconstruido"
    else
        print_warning "Build de backend tardó mucho o falló, intentando sin --no-cache..."
        if timeout 300 $DOCKER_COMPOSE_CMD build --progress=plain backend 2>&1 | tee /tmp/build-backend.log; then
            print_success "Backend reconstruido (con cache)"
        else
            print_error "Error al reconstruir backend"
            print_info "Continuando con imágenes existentes..."
        fi
    fi
    
    print_info "Construyendo frontend..."
    if timeout 300 $DOCKER_COMPOSE_CMD build --progress=plain --no-cache frontend 2>&1 | tee /tmp/build-frontend.log; then
        print_success "Frontend reconstruido"
    else
        print_warning "Build de frontend tardó mucho, intentando sin --no-cache..."
        if timeout 180 $DOCKER_COMPOSE_CMD build --progress=plain frontend 2>&1 | tee /tmp/build-frontend.log; then
            print_success "Frontend reconstruido (con cache)"
        else
            print_warning "Error al reconstruir frontend, usando imagen existente"
        fi
    fi
else
    print_info "Saltando reconstrucción de imágenes, usando las existentes"
fi

print_info "Reiniciando contenedores..."
if $DOCKER_COMPOSE_CMD up -d; then
    print_success "Contenedores reiniciados"
else
    print_error "Error al reiniciar contenedores"
    exit 1
fi

# ============================================
# PASO 10: Verificar servicios
# ============================================
echo ""
echo "📋 PASO 10: Verificando servicios..."
echo ""

print_info "Esperando a que los servicios estén listos..."
sleep 5

if $DOCKER_COMPOSE_CMD ps | grep -q "Up"; then
    print_success "Servicios corriendo correctamente"
    $DOCKER_COMPOSE_CMD ps
else
    print_warning "Algunos servicios pueden no estar corriendo"
    $DOCKER_COMPOSE_CMD ps
fi

# Verificar backend health
print_info "Verificando salud del backend..."
sleep 3
max_attempts=10
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -f http://localhost:3001/health &> /dev/null; then
        print_success "Backend responde correctamente"
        break
    fi
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        print_warning "Backend no responde aún (puede tardar un poco más)"
    else
        sleep 2
    fi
done

# ============================================
# RESUMEN FINAL
# ============================================
echo ""
echo "=============================================="
echo "🎉 ¡Actualización completada!"
echo "=============================================="
echo ""
echo "📍 Servicios:"
echo "   • Frontend:        http://localhost"
echo "   • Backend API:     http://localhost:3001"
echo ""
echo "📚 Comandos útiles:"
echo "   • Ver logs:        $DOCKER_COMPOSE_CMD logs -f"
echo "   • Ver estado:      $DOCKER_COMPOSE_CMD ps"
echo "   • Reiniciar:       $DOCKER_COMPOSE_CMD restart"
echo ""
echo "🔍 Si hay problemas:"
echo "   • Logs backend:    $DOCKER_COMPOSE_CMD logs -f backend"
echo "   • Logs frontend:   $DOCKER_COMPOSE_CMD logs -f frontend"
echo "   • Logs DB:         $DOCKER_COMPOSE_CMD logs -f postgres"
echo ""
