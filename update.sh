#!/bin/bash

# Script de actualización automática para Sistema de Gestión Escolar
# Este script actualiza el sistema, aplica migraciones y resuelve
# automáticamente migraciones fallidas si es necesario

set -e  # Salir si hay algún error

# Colores para los mensajes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
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

# Verificar si es docker-compose o docker compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    DOCKER_COMPOSE_CMD="docker compose"
fi

# Función para resolver migraciones fallidas
resolve_failed_migrations() {
    print_warning "Detectadas migraciones fallidas. Intentando resolver automáticamente..."
    
    # Obtener lista de migraciones fallidas desde la BD
    local failed_migrations=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -t -c \
        "SELECT migration_name FROM \"_prisma_migrations\" WHERE finished_at IS NULL;" 2>/dev/null | \
        tr -d ' ' | grep -v '^$' || echo "")
    
    if [ -z "$failed_migrations" ]; then
        print_warning "No se pudieron identificar migraciones fallidas automáticamente"
        return 1
    fi
    
    # Resolver cada migración fallida
    while IFS= read -r migration; do
        if [ -n "$migration" ]; then
            print_info "Resolviendo migración fallida: $migration"
            if $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate resolve --rolled-back "$migration" 2>&1; then
                print_success "Migración $migration resuelta"
            else
                print_error "Error al resolver migración $migration"
                return 1
            fi
        fi
    done <<< "$failed_migrations"
    
    return 0
}

echo "🔄 Actualización del Sistema de Gestión Escolar"
echo "=============================================="
echo ""

# ============================================
# PASO 1: Actualizar Código desde Git
# ============================================
echo "📋 PASO 1: Actualizando código desde Git..."
echo ""

if [ -d .git ]; then
    print_info "Descargando últimos cambios de Git..."
    if git pull; then
        print_success "Código actualizado desde Git"
    else
        print_warning "Error al actualizar desde Git (puede que no sea un repositorio Git)"
    fi
else
    print_warning "No es un repositorio Git, saltando actualización de código"
fi

# ============================================
# PASO 2: Configurar VITE_API_URL
# ============================================
echo ""
echo "📋 PASO 2: Configurando URL del API..."
echo ""

# Verificar si ya existe frontend/.env
update_ip=""
if [ -f frontend/.env ]; then
    current_url=$(grep "VITE_API_URL" frontend/.env | cut -d'=' -f2 || echo "")
    if [ -n "$current_url" ]; then
        print_info "URL actual del API: $current_url"
        print_info "¿Deseas actualizar la IP del servidor? (s/n)"
        read -r update_ip
        if [[ ! "$update_ip" =~ ^[Ss]$ ]]; then
            print_info "Manteniendo configuración actual"
            server_ip="SKIP"
        fi
    fi
fi

# Si se necesita actualizar o no existe configuración
if [ "$server_ip" != "SKIP" ] && ([ ! -f frontend/.env ] || [[ "$update_ip" =~ ^[Ss]$ ]]); then
    print_info "Ingresa la IP o dominio del servidor (ejemplo: 142.93.17.71 o tu-dominio.com)"
    print_info "Presiona Enter para usar localhost (solo desarrollo local)"
    read -r server_ip
    
    if [ -z "$server_ip" ]; then
        server_ip="localhost"
        print_info "Usando localhost para desarrollo local"
    else
        print_success "IP/Dominio configurado: $server_ip"
    fi
    
    # Crear o actualizar frontend/.env
    print_info "Configurando frontend/.env con VITE_API_URL=http://$server_ip:3000/api/v1"
    mkdir -p frontend
    echo "VITE_API_URL=http://$server_ip:3000/api/v1" > frontend/.env
    print_success "Archivo frontend/.env creado/actualizado"
    
    # También actualizar .env en la raíz si existe
    if [ -f .env ]; then
        if grep -q "VITE_API_URL" .env; then
            sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=http://$server_ip:3000/api/v1|" .env 2>/dev/null || \
            sed -i "s|VITE_API_URL=.*|VITE_API_URL=http://$server_ip:3000/api/v1|" .env
            print_success "VITE_API_URL actualizado en .env"
        else
            echo "VITE_API_URL=http://$server_ip:3000/api/v1" >> .env
            print_success "VITE_API_URL agregado a .env"
        fi
    fi
fi

# ============================================
# PASO 3: Verificar Servicios
# ============================================
echo ""
echo "📋 PASO 3: Verificando servicios Docker..."
echo ""

if ! $DOCKER_COMPOSE_CMD ps &> /dev/null; then
    print_error "No se puede acceder a Docker Compose"
    exit 1
fi

# Verificar si los servicios están corriendo
if ! $DOCKER_COMPOSE_CMD ps | grep -q "Up"; then
    print_warning "Los servicios no están corriendo. Iniciándolos..."
    $DOCKER_COMPOSE_CMD up -d
    sleep 5
fi

print_success "Servicios Docker verificados"

# ============================================
# PASO 4: Reconstruir Contenedores
# ============================================
echo ""
echo "📋 PASO 4: Reconstruyendo contenedores..."
echo ""

print_info "Deteniendo servicios..."
$DOCKER_COMPOSE_CMD down

print_info "Construyendo imágenes con nuevas dependencias..."
if $DOCKER_COMPOSE_CMD build --no-cache; then
    print_success "Imágenes construidas correctamente"
else
    print_error "Error al construir imágenes"
    exit 1
fi

print_info "Levantando contenedores..."
if $DOCKER_COMPOSE_CMD up -d; then
    print_success "Contenedores levantados"
else
    print_error "Error al levantar contenedores"
    exit 1
fi

# ============================================
# PASO 5: Esperar a que los Servicios Estén Listos
# ============================================
echo ""
echo "📋 PASO 5: Esperando a que los servicios estén listos..."
echo ""

print_info "Esperando a que PostgreSQL esté listo..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U gestionscolar &> /dev/null; then
        print_success "PostgreSQL está listo"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Intento $attempt/$max_attempts..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    print_error "PostgreSQL no respondió a tiempo"
    exit 1
fi

sleep 3

print_info "Esperando a que el backend inicie..."
sleep 5

# ============================================
# PASO 6: Actualizar Base de Datos
# ============================================
echo ""
echo "📋 PASO 6: Actualizando base de datos..."
echo ""

# Regenerar cliente de Prisma
print_info "Regenerando cliente de Prisma..."
if $DOCKER_COMPOSE_CMD exec -T backend npm run prisma:generate; then
    print_success "Cliente de Prisma regenerado"
else
    print_error "Error al regenerar cliente de Prisma"
    exit 1
fi

# Verificar estado de migraciones
print_info "Verificando estado de migraciones..."
migration_status=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1)

# Verificar si hay migraciones fallidas
if echo "$migration_status" | grep -q "failed migrations\|P3009"; then
    print_warning "Se detectaron migraciones fallidas"
    if resolve_failed_migrations; then
        print_success "Migraciones fallidas resueltas"
    else
        print_error "No se pudieron resolver las migraciones fallidas automáticamente"
        print_info "Resuélvelas manualmente con:"
        echo "   $DOCKER_COMPOSE_CMD exec backend npx prisma migrate resolve --rolled-back NOMBRE_MIGRACION"
        exit 1
    fi
fi

# Aplicar migraciones
print_info "Aplicando migraciones de base de datos..."
if $DOCKER_COMPOSE_CMD exec -T backend npm run prisma:migrate:deploy; then
    print_success "Migraciones aplicadas correctamente"
else
    print_error "Error al aplicar migraciones"
    
    # Verificar si es error P3009 (migraciones fallidas)
    if $DOCKER_COMPOSE_CMD exec -T backend npm run prisma:migrate:deploy 2>&1 | grep -q "P3009"; then
        print_warning "Error P3009 detectado. Intentando resolver migraciones fallidas..."
        if resolve_failed_migrations; then
            print_info "Reintentando aplicar migraciones..."
            if $DOCKER_COMPOSE_CMD exec -T backend npm run prisma:migrate:deploy; then
                print_success "Migraciones aplicadas después de resolver conflictos"
            else
                print_error "Error persistente al aplicar migraciones"
                exit 1
            fi
        else
            exit 1
        fi
    else
        print_info "Verifica los logs: $DOCKER_COMPOSE_CMD logs backend"
        exit 1
    fi
fi

# Verificar estado final
print_info "Verificando estado final de migraciones..."
if $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status | grep -q "Database schema is up to date\|All migrations have been applied"; then
    print_success "Base de datos sincronizada correctamente"
else
    print_warning "Verifica el estado de las migraciones manualmente"
fi

# ============================================
# PASO 7: Limpieza y Verificación
# ============================================
echo ""
echo "📋 PASO 7: Limpieza y verificación final..."
echo ""

# Limpiar imágenes antiguas (opcional)
print_info "Limpiando imágenes antiguas de Docker..."
if docker image prune -f; then
    print_success "Limpieza completada"
else
    print_warning "Error en la limpieza (no crítico)"
fi

# Verificar servicios
print_info "Verificando estado de servicios..."
sleep 3

if $DOCKER_COMPOSE_CMD ps | grep -q "Up"; then
    print_success "Todos los servicios están corriendo"
    echo ""
    $DOCKER_COMPOSE_CMD ps
else
    print_warning "Algunos servicios pueden no estar corriendo"
    $DOCKER_COMPOSE_CMD ps
fi

# Verificar backend
print_info "Verificando salud del backend..."
sleep 2
if curl -f http://localhost:3000/health &> /dev/null; then
    print_success "Backend responde correctamente"
else
    print_warning "Backend no responde aún (puede tardar unos segundos más)"
fi

# ============================================
# RESUMEN FINAL
# ============================================
echo ""
echo "=============================================="
echo "✅ ¡Actualización completada exitosamente!"
echo "=============================================="
echo ""
echo "📍 Accesos:"
echo "   • Frontend:        http://localhost"
echo "   • Backend API:      http://localhost:3000"
echo "   • API Docs:        http://localhost:3000/api-docs"
echo "   • Health Check:    http://localhost:3000/health"
echo ""
echo "📚 Comandos útiles:"
echo "   • Ver logs:        $DOCKER_COMPOSE_CMD logs -f"
echo "   • Estado:          $DOCKER_COMPOSE_CMD ps"
echo "   • Estado migraciones: $DOCKER_COMPOSE_CMD exec backend npx prisma migrate status"
echo ""

