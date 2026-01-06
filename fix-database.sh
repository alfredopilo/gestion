#!/bin/bash

# Script de reparación de base de datos
# Crea las tablas faltantes y ejecuta migraciones

set -e

echo "🔧 Reparando Base de Datos - Sistema de Gestión Escolar"
echo "======================================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

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

print_info "Verificando servicios..."
$DOCKER_COMPOSE_CMD ps

# ============================================
# PASO 1: Crear tablas de permisos
# ============================================
echo ""
echo "📋 PASO 1: Creando tablas de permisos..."
echo ""

print_info "Creando tabla permissions..."
$DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar << 'EOF'
-- Crear tabla permissions
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    modulo TEXT NOT NULL,
    accion TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice
CREATE INDEX IF NOT EXISTS permissions_nombre_idx ON permissions(nombre);
CREATE INDEX IF NOT EXISTS permissions_modulo_idx ON permissions(modulo);

\echo '✅ Tabla permissions creada/verificada'
EOF

print_info "Creando tabla role_permissions..."
$DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar << 'EOF'
-- Crear tipo ENUM para Rol si no existe
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Rol') THEN
        CREATE TYPE "Rol" AS ENUM ('ADMIN', 'PROFESOR', 'ESTUDIANTE', 'REPRESENTANTE', 'SECRETARIA');
    END IF;
END $$;

-- Crear tabla role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY,
    rol "Rol" NOT NULL,
    permission_id TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) 
        REFERENCES permissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT role_permissions_rol_permission_id_key UNIQUE (rol, permission_id)
);

-- Crear índices
CREATE INDEX IF NOT EXISTS role_permissions_rol_idx ON role_permissions(rol);
CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx ON role_permissions(permission_id);

\echo '✅ Tabla role_permissions creada/verificada'
EOF

print_success "Tablas de permisos creadas"

# ============================================
# PASO 2: Crear tabla access_logs
# ============================================
echo ""
echo "📋 PASO 2: Creando tabla access_logs..."
echo ""

$DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar << 'EOF'
CREATE TABLE IF NOT EXISTS access_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    email TEXT,
    action TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    timestamp TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT access_logs_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS access_logs_user_id_idx ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS access_logs_action_idx ON access_logs(action);
CREATE INDEX IF NOT EXISTS access_logs_timestamp_idx ON access_logs(timestamp);

\echo '✅ Tabla access_logs creada/verificada'
EOF

print_success "Tabla access_logs creada"

# ============================================
# PASO 3: Verificar tablas
# ============================================
echo ""
echo "📋 PASO 3: Verificando tablas creadas..."
echo ""

$DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar << 'EOF'
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
        ) THEN '✅ OK'
        ELSE '❌ FALTA'
    END as estado
FROM (
    VALUES 
        ('permissions'),
        ('role_permissions'),
        ('access_logs'),
        ('users'),
        ('students')
) AS t(table_name)
ORDER BY table_name;
EOF

# ============================================
# PASO 4: Regenerar Prisma Client
# ============================================
echo ""
echo "📋 PASO 4: Regenerando Prisma Client..."
echo ""

print_info "Regenerando Prisma Client en backend..."
if $DOCKER_COMPOSE_CMD exec -T backend npx prisma generate 2>&1 | tail -5; then
    print_success "Prisma Client regenerado"
else
    print_warning "Error al regenerar Prisma Client"
fi

# ============================================
# PASO 5: Marcar migraciones como aplicadas
# ============================================
echo ""
echo "📋 PASO 5: Sincronizando estado de migraciones..."
echo ""

print_info "Marcando migraciones como aplicadas..."
$DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate resolve --applied 20260106_add_access_logs 2>&1 || {
    print_info "No hay migraciones pendientes para marcar"
}

# ============================================
# PASO 6: Ejecutar seed de permisos
# ============================================
echo ""
echo "📋 PASO 6: Ejecutando seed de permisos..."
echo ""

# Copiar archivo seed al contenedor
if [ -f "backend/prisma/seed-permissions.js" ]; then
    print_info "Copiando seed-permissions.js al contenedor..."
    $DOCKER_COMPOSE_CMD cp backend/prisma/seed-permissions.js backend:/app/prisma/seed-permissions.js 2>&1 || true
fi

print_info "Ejecutando seed..."
seed_output=$($DOCKER_COMPOSE_CMD exec -T backend node prisma/seed-permissions.js 2>&1)

if echo "$seed_output" | grep -q "Seed completado\|Total de permisos"; then
    print_success "Seed de permisos ejecutado correctamente"
    echo "$seed_output" | grep -E "Total de permisos|Total de asignaciones"
else
    print_warning "Verificar resultado del seed"
    echo "$seed_output" | tail -10
fi

# ============================================
# PASO 7: Reiniciar backend
# ============================================
echo ""
echo "📋 PASO 7: Reiniciando backend..."
echo ""

print_info "Reiniciando contenedor backend..."
$DOCKER_COMPOSE_CMD restart backend

print_info "Esperando a que el backend esté listo..."
sleep 10

# ============================================
# PASO 8: Verificación final
# ============================================
echo ""
echo "📋 PASO 8: Verificación final..."
echo ""

print_info "Estado de servicios:"
$DOCKER_COMPOSE_CMD ps

print_info "Verificando backend..."
max_attempts=10
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -f http://localhost:3001/health &> /dev/null 2>&1; then
        print_success "Backend responde correctamente"
        break
    fi
    attempt=$((attempt + 1))
    if [ $attempt -lt $max_attempts ]; then
        echo "   Intento $attempt/$max_attempts..."
        sleep 2
    fi
done

if [ $attempt -eq $max_attempts ]; then
    print_warning "Backend no responde en /health"
    print_info "Logs del backend:"
    $DOCKER_COMPOSE_CMD logs backend --tail=30
else
    # Verificar que no haya errores de tabla
    print_info "Verificando logs del backend..."
    recent_logs=$($DOCKER_COMPOSE_CMD logs backend --tail=20 2>&1)
    
    if echo "$recent_logs" | grep -q "role_permissions.*does not exist"; then
        print_error "Todavía hay errores de tabla role_permissions"
        print_info "Mostrando logs:"
        echo "$recent_logs"
    elif echo "$recent_logs" | grep -q "prisma:error"; then
        print_warning "Hay errores de Prisma en los logs"
        echo "$recent_logs" | grep -A 2 "prisma:error"
    else
        print_success "No se detectaron errores en los logs recientes"
    fi
fi

# ============================================
# RESUMEN
# ============================================
echo ""
echo "=============================================="
echo "✅ Reparación de base de datos completada"
echo "=============================================="
echo ""
echo "📊 Verificación de tablas:"
$DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -c "
SELECT COUNT(*) as total_permissions FROM permissions;
SELECT COUNT(*) as total_role_permissions FROM role_permissions;
SELECT COUNT(*) as total_access_logs FROM access_logs;
" 2>&1 | grep -E "total_|rows"

echo ""
echo "🔍 Si todavía hay problemas:"
echo "   1. Ver logs: docker compose logs backend -f"
echo "   2. Reiniciar todo: docker compose restart"
echo "   3. Verificar BD: docker compose exec postgres psql -U gestionscolar -d gestion_escolar"
echo ""
