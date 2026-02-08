#!/bin/bash

# Script para verificar y aplicar migraciones de Prisma - Sistema de Gestión Escolar
# Uso: ./aplicar_migraciones.sh
# Requiere: Docker Compose con servicios postgres y backend levantados
# Permisos: chmod +x aplicar_migraciones.sh

# No usar set -e: manejamos errores explícitamente para dar mensajes claros y reintentos
echo "🔧 Verificar y aplicar migraciones - Gestión Escolar"
echo "===================================================="
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
print_error()   { echo -e "${RED}❌ $1${NC}"; }
print_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_step()    { echo -e "${CYAN}▶️  $1${NC}"; }

# Detectar comando Docker Compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    DOCKER_COMPOSE_CMD="docker compose"
fi

# Salir con mensaje de error
exit_with_error() {
    print_error "$1"
    [ -n "$2" ] && print_info "$2"
    exit 1
}

# Resolver migraciones fallidas (registros en _prisma_migrations sin finished_at)
resolve_failed_migrations() {
    print_warning "Intentando resolver migraciones fallidas..."
    local failed_migrations
    failed_migrations=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -t -c \
        "SELECT migration_name FROM \"_prisma_migrations\" WHERE finished_at IS NULL;" 2>/dev/null | \
        tr -d ' \r' | grep -v '^$' || true)

    if [ -z "$failed_migrations" ]; then
        print_warning "No se pudieron listar migraciones fallidas desde la BD"
        print_info "Resolución manual: $DOCKER_COMPOSE_CMD exec backend npx prisma migrate resolve --rolled-back NOMBRE_MIGRACION"
        return 1
    fi

    while IFS= read -r migration; do
        [ -z "$migration" ] && continue
        print_info "Resolviendo: $migration"
        if $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate resolve --rolled-back "$migration" 2>&1; then
            print_success "Resuelta: $migration"
        else
            print_error "No se pudo resolver: $migration"
            return 1
        fi
    done <<< "$failed_migrations"
    return 0
}

# ============================================
# PASO 0: Comprobar que estamos en el proyecto
# ============================================
if [ ! -d "backend/prisma" ]; then
    exit_with_error "No se encuentra backend/prisma. Ejecuta este script desde la raíz del proyecto (donde está docker-compose.yml)."
fi

if [ ! -f "backend/prisma/schema.prisma" ]; then
    exit_with_error "No se encuentra backend/prisma/schema.prisma."
fi

# ============================================
# PASO 1: Verificar que los servicios estén levantados
# ============================================
print_step "PASO 1: Verificando servicios Docker..."
echo ""

if ! $DOCKER_COMPOSE_CMD ps postgres 2>/dev/null | grep -q "Up"; then
    exit_with_error "PostgreSQL no está corriendo." "Levanta los servicios: $DOCKER_COMPOSE_CMD up -d"
fi
print_success "PostgreSQL está en ejecución"

if ! $DOCKER_COMPOSE_CMD ps backend 2>/dev/null | grep -q "Up"; then
    print_warning "El contenedor backend no está corriendo. Intentando levantar..."
    $DOCKER_COMPOSE_CMD up -d backend 2>&1 || exit_with_error "No se pudo levantar el backend."
    print_info "Esperando 15 segundos a que el backend inicie..."
    sleep 15
fi
print_success "Backend está en ejecución"
echo ""

# ============================================
# PASO 2: Esperar a que PostgreSQL y backend estén listos
# ============================================
print_step "PASO 2: Esperando disponibilidad de servicios..."
echo ""

print_info "Comprobando PostgreSQL..."
i=1
while [ "$i" -le 15 ]; do
    if $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U gestionscolar -d gestion_escolar &>/dev/null; then
        print_success "PostgreSQL aceptando conexiones"
        break
    fi
    [ "$i" -eq 15 ] && exit_with_error "PostgreSQL no respondió a tiempo."
    echo "   Intento $i/15..."
    sleep 2
    i=$((i + 1))
done

print_info "Comprobando contenedor backend..."
i=1
while [ "$i" -le 15 ]; do
    if $DOCKER_COMPOSE_CMD exec -T backend sh -c "exit 0" 2>/dev/null; then
        print_success "Backend listo"
        break
    fi
    [ "$i" -eq 15 ] && exit_with_error "El contenedor backend no respondió a tiempo."
    echo "   Intento $i/15..."
    sleep 2
    i=$((i + 1))
done
echo ""

# ============================================
# PASO 3: Verificar estado actual de migraciones
# ============================================
print_step "PASO 3: Verificando estado de migraciones..."
echo ""

migration_status=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1) || true
echo "$migration_status" | head -20

if echo "$migration_status" | grep -qE "failed migrations|P3009|failed"; then
    print_warning "Se detectaron migraciones fallidas."
    if ! resolve_failed_migrations; then
        exit_with_error "No se pudieron resolver las migraciones fallidas." \
            "Revisa: $DOCKER_COMPOSE_CMD exec backend npx prisma migrate status"
    fi
    print_success "Migraciones fallidas resueltas. Se aplicarán de nuevo en el siguiente paso."
elif echo "$migration_status" | grep -qE "Database schema is up to date|No pending|up to date"; then
    print_success "La base de datos ya está al día (sin migraciones pendientes)."
    print_info "Regenerando Prisma Client por si hubo cambios en schema..."
fi
echo ""

# ============================================
# PASO 4: Regenerar Prisma Client
# ============================================
print_step "PASO 4: Regenerando Prisma Client..."
echo ""

if ! $DOCKER_COMPOSE_CMD exec -T backend npx prisma generate 2>&1; then
    exit_with_error "Error al ejecutar prisma generate." \
        "Revisa que backend/prisma/schema.prisma sea válido."
fi
print_success "Prisma Client generado correctamente"
echo ""

# ============================================
# PASO 5: Aplicar migraciones (migrate deploy)
# ============================================
print_step "PASO 5: Aplicando migraciones pendientes..."
echo ""

deploy_output=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy 2>&1)
deploy_exit=$?

echo "$deploy_output"

if [ "$deploy_exit" -ne 0 ]; then
    if echo "$deploy_output" | grep -qE "P3009|failed"; then
        print_warning "Error P3009 o migraciones fallidas. Reintentando después de resolver..."
        if resolve_failed_migrations; then
            deploy_output=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy 2>&1)
            deploy_exit=$?
            echo "$deploy_output"
        fi
    fi
    if [ "$deploy_exit" -ne 0 ]; then
        exit_with_error "Error al aplicar migraciones (exit $deploy_exit)." \
            "Revisa: $DOCKER_COMPOSE_CMD exec backend npx prisma migrate status"
    fi
fi

if echo "$deploy_output" | grep -qE "Applied the following|migrations have been applied|Applying migration"; then
    print_success "Migraciones aplicadas correctamente"
elif echo "$deploy_output" | grep -qE "No pending|already applied|Database schema is up to date"; then
    print_success "No había migraciones pendientes (esquema ya actualizado)"
else
    print_success "Comando migrate deploy finalizado"
fi
echo ""

# ============================================
# PASO 6: Verificación final del estado
# ============================================
print_step "PASO 6: Verificación final..."
echo ""

final_status=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1)
if echo "$final_status" | grep -qE "Database schema is up to date|No pending|up to date|applied"; then
    print_success "Estado final: base de datos sincronizada con el esquema"
else
    print_warning "Estado final:"
    echo "$final_status" | head -15
fi
echo ""

# ============================================
# PASO 7 (opcional): Seed de permisos
# ============================================
if [ -f "backend/prisma/seed-permissions.js" ]; then
    print_step "PASO 7: Ejecutando seed de permisos..."
    echo ""
    if seed_out=$($DOCKER_COMPOSE_CMD exec -T backend node prisma/seed-permissions.js 2>&1); then
        if echo "$seed_out" | grep -qE "Seed completado|Total de permisos|✅"; then
            print_success "Seed de permisos ejecutado"
        else
            echo "$seed_out" | tail -5
        fi
    else
        print_warning "Seed de permisos falló o no es necesario (puede que ya existan)"
    fi
    echo ""
fi

# ============================================
# RESUMEN
# ============================================
echo "===================================================="
print_success "Verificación y aplicación de migraciones completada"
echo "===================================================="
echo ""
print_info "Comandos útiles:"
echo "   Estado:    $DOCKER_COMPOSE_CMD exec backend npx prisma migrate status"
echo "   Regenerar: $DOCKER_COMPOSE_CMD exec backend npx prisma generate"
echo "   Deploy:    $DOCKER_COMPOSE_CMD exec backend npx prisma migrate deploy"
echo ""
exit 0
