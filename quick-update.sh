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
    print_info "Reconstruyendo backend (esto puede tardar 2-5 minutos)..."
    export DOCKER_BUILDKIT=1
    
    # Build con timeout y sin provenance
    if timeout 600 $DOCKER_COMPOSE_CMD build --progress=plain backend 2>&1 | grep -E "(Step|CACHED|DONE|ERROR|Built)" | tail -20; then
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
# PASO 4: Aplicar migraciones
# ============================================
echo ""
echo "📋 PASO 4: Aplicando migraciones..."
echo ""

print_info "Aplicando migraciones pendientes..."
if $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy 2>&1 | tail -10; then
    print_success "Migraciones aplicadas"
else
    print_warning "Puede haber errores en migraciones, verificando estado..."
    $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1 | tail -5 || true
fi

# ============================================
# PASO 5: Crear tabla access_logs si no existe
# ============================================
echo ""
echo "📋 PASO 5: Verificando tabla access_logs..."
echo ""

print_info "Verificando/creando tabla access_logs..."
$DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -c "
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
" 2>&1 | grep -v "CREATE\|already exists" || print_success "Tabla access_logs verificada"

# ============================================
# PASO 6: Reiniciar servicios
# ============================================
echo ""
echo "📋 PASO 6: Reiniciando servicios..."
echo ""

print_info "Reiniciando contenedores..."
if $DOCKER_COMPOSE_CMD up -d; then
    print_success "Servicios reiniciados"
else
    print_error "Error al reiniciar servicios"
    exit 1
fi

# ============================================
# PASO 7: Verificar servicios
# ============================================
echo ""
echo "📋 PASO 7: Verificando servicios..."
echo ""

print_info "Esperando a que los servicios estén listos..."
sleep 5

print_info "Estado de servicios:"
$DOCKER_COMPOSE_CMD ps

# Verificar backend
print_info "Verificando backend..."
max_attempts=10
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -f http://localhost:3001/health &> /dev/null 2>&1; then
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
