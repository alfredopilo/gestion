#!/bin/bash

# Script de instalación automática para Sistema de Gestión Escolar
# Este script automatiza el proceso completo de instalación incluyendo
# resolución automática de migraciones fallidas de Prisma

set -e  # Salir si hay algún error

echo "🚀 Instalación del Sistema de Gestión Escolar"
echo "=============================================="
echo ""

# Colores para output
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

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Función para esperar a que un servicio esté listo
wait_for_service() {
    local service=$1
    local max_attempts=${2:-30}
    local attempt=0
    
    print_info "Esperando a que $service esté listo..."
    while [ $attempt -lt $max_attempts ]; do
        if $DOCKER_COMPOSE_CMD exec -T "$service" sh -c "exit 0" &> /dev/null; then
            print_success "$service está listo"
            return 0
        fi
        attempt=$((attempt + 1))
        echo "   Intento $attempt/$max_attempts..."
        sleep 2
    done
    
    print_error "$service no respondió a tiempo"
    return 1
}

# Función para resolver migraciones fallidas automáticamente
resolve_failed_migrations() {
    print_warning "Detectadas migraciones fallidas. Intentando resolver automáticamente..."
    
    # Obtener lista de migraciones fallidas desde la BD
    local failed_migrations=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -t -c \
        "SELECT migration_name FROM \"_prisma_migrations\" WHERE finished_at IS NULL;" 2>/dev/null | \
        tr -d ' ' | grep -v '^$' || echo "")
    
    if [ -z "$failed_migrations" ]; then
        print_warning "No se pudieron identificar migraciones fallidas automáticamente"
        print_info "Puedes resolverlas manualmente con:"
        echo "   $DOCKER_COMPOSE_CMD exec backend npx prisma migrate resolve --rolled-back NOMBRE_MIGRACION"
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

# ============================================
# PASO 1: Verificación de Requisitos
# ============================================
echo "📋 PASO 1: Verificando requisitos..."
echo ""

# Verificar Docker
if ! command_exists docker; then
    print_error "Docker no está instalado. Por favor instala Docker primero."
    echo "   Instalación: https://docs.docker.com/get-docker/"
    exit 1
fi
print_success "Docker está instalado ($(docker --version | cut -d' ' -f3 | cut -d',' -f1))"

# Verificar Docker Compose
if ! command_exists docker-compose && ! docker compose version &> /dev/null; then
    print_error "Docker Compose no está instalado."
    exit 1
fi

# Verificar si es docker-compose o docker compose
if command_exists docker-compose; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    DOCKER_COMPOSE_CMD="docker compose"
fi
print_success "Docker Compose está disponible"

# Verificar que Docker esté corriendo
if ! docker info &> /dev/null; then
    print_error "Docker no está corriendo. Por favor inicia Docker."
    exit 1
fi
print_success "Docker está corriendo"

# Verificar permisos
if ! docker ps &> /dev/null; then
    print_error "No tienes permisos para ejecutar Docker. Ejecuta con sudo o agrega tu usuario al grupo docker."
    exit 1
fi
print_success "Permisos de Docker verificados"

# ============================================
# PASO 2: Verificar Servicios Existentes
# ============================================
echo ""
echo "📋 PASO 2: Verificando servicios existentes..."
echo ""

if $DOCKER_COMPOSE_CMD ps | grep -q "Up"; then
    print_warning "Los servicios ya están corriendo"
    echo "   ¿Deseas detenerlos y reinstalar? (s/n)"
    read -r response
    if [[ "$response" =~ ^[Ss]$ ]]; then
        print_info "Deteniendo servicios existentes..."
        $DOCKER_COMPOSE_CMD down
        print_success "Servicios detenidos"
    else
        print_info "Continuando con servicios existentes..."
    fi
fi

# ============================================
# PASO 3: Configuración de Archivos
# ============================================
echo ""
echo "📋 PASO 3: Configurando archivos de entorno..."
echo ""

# Verificar archivo .env en raíz
if [ ! -f .env ]; then
    print_warning "No se encontró .env en la raíz. Usando valores por defecto."
    print_info "Puedes crear .env manualmente si necesitas personalizar la configuración."
else
    print_success "Archivo .env encontrado en la raíz"
fi

# Verificar .env en frontend
if [ ! -f frontend/.env ]; then
    print_warning "No se encontró frontend/.env"
    print_info "El frontend usará la URL por defecto (localhost:3000)"
    print_info "Para producción, crea frontend/.env con: VITE_API_URL=http://TU_IP:3000/api/v1"
else
    print_success "Archivo frontend/.env encontrado"
fi

# ============================================
# PASO 4: Construcción y Levantado de Servicios
# ============================================
echo ""
echo "📋 PASO 4: Construyendo y levantando servicios Docker..."
echo ""

print_info "Construyendo imágenes (esto puede tardar varios minutos)..."
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

# Esperar a PostgreSQL
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
    print_info "Verifica los logs: $DOCKER_COMPOSE_CMD logs postgres"
    exit 1
fi

# Esperar un poco más para que la BD esté completamente lista
sleep 3

# Esperar a Backend
wait_for_service backend 20

# ============================================
# PASO 6: Configuración de Base de Datos
# ============================================
echo ""
echo "📋 PASO 6: Configurando base de datos..."
echo ""

# Generar cliente de Prisma
print_info "Generando cliente de Prisma..."
if $DOCKER_COMPOSE_CMD exec -T backend npm run prisma:generate; then
    print_success "Cliente de Prisma generado"
else
    print_error "Error al generar cliente de Prisma"
    exit 1
fi

# Verificar estado de migraciones antes de aplicar
print_info "Verificando estado de migraciones..."
migration_status_output=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1)

# Verificar si hay migraciones fallidas
if echo "$migration_status_output" | grep -q "failed migrations\|P3009"; then
    print_warning "Se detectaron migraciones fallidas"
    if resolve_failed_migrations; then
        print_success "Migraciones fallidas resueltas"
    else
        print_error "No se pudieron resolver las migraciones fallidas automáticamente"
        print_info "Resuélvelas manualmente y vuelve a ejecutar el script"
        exit 1
    fi
fi

# Aplicar migraciones
print_info "Aplicando migraciones de base de datos..."
if $DOCKER_COMPOSE_CMD exec -T backend npm run prisma:migrate:deploy; then
    print_success "Migraciones aplicadas correctamente"
else
    print_error "Error al aplicar migraciones"
    print_info "Verifica los logs: $DOCKER_COMPOSE_CMD logs backend"
    
    # Intentar resolver migraciones fallidas si el error es P3009
    if $DOCKER_COMPOSE_CMD exec -T backend npm run prisma:migrate:deploy 2>&1 | grep -q "P3009"; then
        print_warning "Error P3009 detectado. Intentando resolver..."
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
        exit 1
    fi
fi

# Verificar estado final de migraciones
print_info "Verificando estado final de migraciones..."
if $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status | grep -q "Database schema is up to date\|All migrations have been applied"; then
    print_success "Base de datos sincronizada correctamente"
else
    print_warning "Verifica el estado de las migraciones manualmente"
fi

# Poblar base de datos con datos iniciales (seed)
print_info "Poblando base de datos con datos iniciales..."
if $DOCKER_COMPOSE_CMD exec -T backend npm run prisma:seed 2>&1 | grep -q "Error\|error"; then
    print_warning "Error al poblar base de datos (puede que ya tenga datos)"
else
    print_success "Base de datos poblada con datos iniciales"
fi

# ============================================
# PASO 7: Verificación Final
# ============================================
echo ""
echo "📋 PASO 7: Verificación final de servicios..."
echo ""

sleep 3

# Verificar contenedores
print_info "Verificando estado de contenedores..."
if $DOCKER_COMPOSE_CMD ps | grep -q "Up"; then
    print_success "Todos los servicios están corriendo"
    $DOCKER_COMPOSE_CMD ps
else
    print_warning "Algunos servicios pueden no estar corriendo"
    $DOCKER_COMPOSE_CMD ps
fi

# Verificar backend health
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
echo "🎉 ¡Instalación completada!"
echo "=============================================="
echo ""
echo "📍 Accesos:"
echo "   • Frontend:        http://localhost"
echo "   • Backend API:      http://localhost:3000"
echo "   • API Docs:        http://localhost:3000/api-docs"
echo "   • Health Check:    http://localhost:3000/health"
echo ""
echo "👤 Credenciales de acceso:"
echo "   • Admin:           admin@gestionescolar.edu / admin123"
echo "   • Profesor:        profesor@gestionescolar.edu / profesor123"
echo "   • Estudiante:      estudiante@gestionescolar.edu / estudiante123"
echo "   • Representante:   representante@gestionescolar.edu / representante123"
echo ""
echo "📚 Comandos útiles:"
echo "   • Ver logs:        $DOCKER_COMPOSE_CMD logs -f"
echo "   • Ver logs backend: $DOCKER_COMPOSE_CMD logs -f backend"
echo "   • Detener:         $DOCKER_COMPOSE_CMD down"
echo "   • Reiniciar:       $DOCKER_COMPOSE_CMD restart"
echo "   • Estado:          $DOCKER_COMPOSE_CMD ps"
echo ""
echo "🔧 Comandos de Prisma:"
echo "   • Estado migraciones: $DOCKER_COMPOSE_CMD exec backend npx prisma migrate status"
echo "   • Aplicar migraciones: $DOCKER_COMPOSE_CMD exec backend npm run prisma:migrate:deploy"
echo "   • Regenerar cliente: $DOCKER_COMPOSE_CMD exec backend npm run prisma:generate"
echo ""
echo "📖 Para más información, consulta:"
echo "   • VERIFICACION_VPS.md - Guía completa de verificación"
echo "   • CONFIGURACION_VPS.md - Configuración para VPS"
echo ""

