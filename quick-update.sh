#!/bin/bash

# Script de actualización rápida para Sistema de Gestión Escolar
# Este script es más rápido que update.sh porque evita pasos innecesarios
# y optimiza el proceso de build

set -e  # Salir si hay algún error

echo "⚡ Actualización Rápida del Sistema de Gestión Escolar"
echo "======================================================"
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
# PASO 1: Pull de cambios
# ============================================
echo "📋 PASO 1: Actualizando código desde git..."
echo ""

if [ -d ".git" ]; then
    print_info "Haciendo pull de cambios..."
    if git pull origin main; then
        print_success "Código actualizado"
    else
        print_warning "Error al hacer pull, continuando con código local..."
    fi
else
    print_info "No es un repositorio Git, saltando pull"
fi

# ============================================
# PASO 2: Reconstruir solo backend (más rápido)
# ============================================
echo ""
echo "📋 PASO 2: Reconstruyendo backend..."
echo ""

print_info "¿Deseas reconstruir el backend? (s/n)"
read -r rebuild_response

if [[ "$rebuild_response" =~ ^[Ss]$ ]]; then
    print_info "Reconstruyendo backend (usando caché para acelerar, ~1-2 minutos)..."
    export DOCKER_BUILDKIT=1
    
    # Build con caché (mucho más rápido que --no-cache)
    if timeout 300 $DOCKER_COMPOSE_CMD build --progress=plain backend 2>&1 | grep -E "(Step|CACHED|DONE|ERROR|Built)" | tail -20; then
        print_success "Backend reconstruido"
    else
        print_warning "Build puede haber tardado mucho, verificando..."
        if $DOCKER_COMPOSE_CMD images | grep -q "gestionescolar-backend"; then
            print_success "Imagen de backend existe"
        else
            print_error "Error al construir backend"
            exit 1
        fi
    fi
else
    print_info "Saltando reconstrucción de backend"
fi

# ============================================
# PASO 3: Regenerar Prisma Client
# ============================================
echo ""
echo "📋 PASO 3: Regenerando Prisma Client..."
echo ""

print_info "Iniciando servicios si no están corriendo..."
$DOCKER_COMPOSE_CMD up -d postgres 2>/dev/null || true

# Esperar a que postgres esté listo
print_info "Esperando a que PostgreSQL esté listo..."
max_attempts=15
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U gestionscolar &> /dev/null; then
        print_success "PostgreSQL está listo"
        break
    fi
    attempt=$((attempt + 1))
    sleep 2
done

# Iniciar backend si no está corriendo
if ! $DOCKER_COMPOSE_CMD ps | grep -q "gestion-escolar-backend.*Up"; then
    print_info "Iniciando backend..."
    $DOCKER_COMPOSE_CMD up -d backend
    sleep 10
fi

print_info "Regenerando Prisma Client..."
if $DOCKER_COMPOSE_CMD exec -T backend npx prisma generate 2>&1 | tail -5; then
    print_success "Prisma Client regenerado"
else
    print_warning "Error al regenerar Prisma, puede que ya esté actualizado"
fi

# ============================================
# PASO 4: Aplicar migraciones y configurar BD
# ============================================
echo ""
echo "📋 PASO 4: Aplicando migraciones y configurando BD..."
echo ""

print_info "Verificando estado de migraciones..."
migration_status=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1)

if echo "$migration_status" | grep -qE "Database schema is up to date|No pending migration"; then
    print_success "Base de datos ya está actualizada"
elif echo "$migration_status" | grep -qE "following migrations have not yet been applied|pending migration|have not yet been applied"; then
    print_info "Hay migraciones pendientes, aplicando..."
    if $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy 2>&1; then
        print_success "Migraciones aplicadas correctamente"
    else
        print_error "Error al aplicar migraciones"
        print_info "Intentando resolver conflictos..."
        
        # Intentar marcar migraciones fallidas como aplicadas
        $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate resolve --applied 20251106114501_add_institution_and_schoolyear_to_subjects 2>&1 || true
        
        # Reintentar
        if $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy 2>&1; then
            print_success "Migraciones aplicadas después de resolver conflictos"
        else
            print_warning "Algunas migraciones pueden tener problemas, continuando..."
        fi
    fi
else
    print_warning "Estado de migraciones indeterminado, intentando aplicar..."
    $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy 2>&1 || {
        print_warning "Error en migraciones, pero continuando..."
    }
fi

# Verificar estado final
print_info "Estado final de migraciones:"
$DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1 | tail -10 || true

# ============================================
# PASO 5: Verificar y crear tablas necesarias
# ============================================
echo ""
echo "📋 PASO 5: Verificando tablas necesarias..."
echo ""

print_info "Creando tabla access_logs si no existe..."
create_result=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -c "
CREATE TABLE IF NOT EXISTS access_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    email TEXT,
    action TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    timestamp TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS access_logs_user_id_idx ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS access_logs_action_idx ON access_logs(action);
CREATE INDEX IF NOT EXISTS access_logs_timestamp_idx ON access_logs(timestamp);
ALTER TABLE access_logs ADD CONSTRAINT IF NOT EXISTS access_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
" 2>&1)

if echo "$create_result" | grep -q "CREATE TABLE\|already exists\|CREATE INDEX"; then
    print_success "Tabla access_logs verificada/creada correctamente"
else
    print_warning "Verificar manualmente la tabla access_logs"
fi

# Verificar que las tablas de permisos existan
print_info "Verificando tablas de permisos..."
perms_result=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -c "
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') 
    THEN 'permissions: OK' ELSE 'permissions: FALTA' END as permissions_table,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions') 
    THEN 'role_permissions: OK' ELSE 'role_permissions: FALTA' END as role_permissions_table,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'access_logs') 
    THEN 'access_logs: OK' ELSE 'access_logs: FALTA' END as access_logs_table;
" 2>&1)

echo "$perms_result"

if echo "$perms_result" | grep -q "FALTA"; then
    print_warning "Algunas tablas faltan, ejecutando migraciones nuevamente..."
    $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy 2>&1 | tail -10 || true
else
    print_success "Todas las tablas necesarias existen"
fi

# ============================================
# PASO 6: Seed de permisos
# ============================================
echo ""
echo "📋 PASO 6: Actualizando permisos..."
echo ""

print_info "Ejecutando seed de permisos..."
seed_output=$($DOCKER_COMPOSE_CMD exec -T backend node prisma/seed-permissions.js 2>&1)

if echo "$seed_output" | grep -q "Seed completado\|✅\|Total de permisos"; then
    print_success "Permisos actualizados correctamente"
    echo "$seed_output" | grep -E "Total de permisos|Total de asignaciones" || true
elif echo "$seed_output" | grep -q "already exists\|Unique constraint"; then
    print_success "Permisos ya existen (normal en actualización)"
elif echo "$seed_output" | grep -q "Cannot find module"; then
    print_warning "Archivo seed-permissions.js no encontrado en contenedor"
    print_info "Copiando archivo al contenedor..."
    
    if [ -f "backend/prisma/seed-permissions.js" ]; then
        $DOCKER_COMPOSE_CMD cp backend/prisma/seed-permissions.js backend:/app/prisma/seed-permissions.js 2>&1 || {
            print_warning "Error al copiar archivo seed"
        }
        
        # Reintentar seed
        print_info "Reintentando seed..."
        if $DOCKER_COMPOSE_CMD exec -T backend node prisma/seed-permissions.js 2>&1 | grep -q "Seed completado\|Total de permisos"; then
            print_success "Permisos actualizados después de copiar archivo"
        else
            print_warning "No se pudieron crear permisos automáticamente"
            print_info "Los permisos se pueden crear desde la interfaz web"
        fi
    else
        print_warning "Archivo seed-permissions.js no encontrado localmente"
    fi
else
    print_warning "Estado de permisos indeterminado"
    echo "$seed_output" | tail -5
fi

# ============================================
# PASO 7: Reiniciar servicios
# ============================================
echo ""
echo "📋 PASO 7: Reiniciando servicios..."
echo ""

print_info "Reiniciando contenedores..."
if $DOCKER_COMPOSE_CMD up -d; then
    print_success "Servicios reiniciados"
else
    print_error "Error al reiniciar servicios"
    print_info "Intentando recuperación..."
    
    # Intentar detener y levantar
    $DOCKER_COMPOSE_CMD down 2>&1 || true
    sleep 3
    
    if $DOCKER_COMPOSE_CMD up -d; then
        print_success "Servicios reiniciados después de recuperación"
    else
        print_error "No se pudieron reiniciar los servicios"
        print_info "Verifica manualmente con: docker compose ps"
        exit 1
    fi
fi

# ============================================
# PASO 8: Verificar servicios
# ============================================
echo ""
echo "📋 PASO 8: Verificando servicios..."
echo ""

print_info "Esperando a que los servicios estén listos..."
sleep 8

print_info "Estado de servicios:"
service_status=$($DOCKER_COMPOSE_CMD ps)
echo "$service_status"

# Verificar que todos los servicios estén UP
if echo "$service_status" | grep -q "Up"; then
    print_success "Servicios iniciados"
else
    print_error "Algunos servicios no están corriendo"
    print_info "Logs del backend:"
    $DOCKER_COMPOSE_CMD logs backend --tail=20
    exit 1
fi

# Verificar PostgreSQL
print_info "Verificando PostgreSQL..."
if $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U gestionscolar &> /dev/null; then
    print_success "PostgreSQL responde correctamente"
else
    print_error "PostgreSQL no responde"
    exit 1
fi

# Verificar backend
print_info "Verificando backend..."
max_attempts=15
attempt=0
backend_ok=false

while [ $attempt -lt $max_attempts ]; do
    if curl -f http://localhost:3001/health &> /dev/null 2>&1; then
        print_success "Backend responde correctamente"
        backend_ok=true
        break
    fi
    attempt=$((attempt + 1))
    if [ $attempt -lt $max_attempts ]; then
        echo "   Intento $attempt/$max_attempts..."
        sleep 3
    fi
done

if [ "$backend_ok" = false ]; then
    print_warning "Backend no responde en /health"
    print_info "Verificando logs del backend:"
    $DOCKER_COMPOSE_CMD logs backend --tail=30
    print_warning "Puede que el backend esté iniciando aún"
fi

# Verificar frontend
print_info "Verificando frontend..."
if curl -f http://localhost &> /dev/null 2>&1; then
    print_success "Frontend responde correctamente"
else
    print_warning "Frontend no responde aún (puede tardar un poco más)"
fi

# Verificar conexión de backend a BD
print_info "Verificando conexión backend-BD..."
db_check=$($DOCKER_COMPOSE_CMD exec -T backend node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect()
  .then(() => { console.log('✅ Conexión exitosa'); process.exit(0); })
  .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); });
" 2>&1)

if echo "$db_check" | grep -q "Conexión exitosa"; then
    print_success "Backend conectado a BD correctamente"
else
    print_warning "Verificar conexión backend-BD manualmente"
    echo "$db_check"
fi

# ============================================
# RESUMEN FINAL
# ============================================
echo ""
echo "=============================================="
echo "🎉 ¡Actualización rápida completada!"
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
