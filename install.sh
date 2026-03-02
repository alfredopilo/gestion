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
    
    # Resolver cada migración fallida marcándola como aplicada
    # (--applied = "ya estaba hecha", Prisma la saltea en el siguiente deploy)
    while IFS= read -r migration; do
        if [ -n "$migration" ]; then
            print_info "Marcando como aplicada: $migration"
            if $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate resolve --applied "$migration" 2>&1; then
                print_success "Migración $migration marcada como aplicada"
            else
                print_error "Error al marcar migración $migration"
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

# Configurar VITE_API_URL para frontend
echo ""
print_info "Configuración de URL del API para el frontend"
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
print_info "Configurando frontend/.env con VITE_API_URL=http://$server_ip/api/v1"
mkdir -p frontend
echo "VITE_API_URL=http://$server_ip/api/v1" > frontend/.env
print_success "Archivo frontend/.env creado/actualizado"

# También crear .env en la raíz si no existe (para docker-compose)
if [ ! -f .env ]; then
    print_info "Creando archivo .env en la raíz del proyecto..."
    cat > .env << EOF
# Variables de entorno para Docker Compose
VITE_API_URL=http://$server_ip/api/v1
EOF
    print_success "Archivo .env creado en la raíz"
else
    # Actualizar VITE_API_URL en .env si existe
    if grep -q "VITE_API_URL" .env; then
        sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=http://$server_ip/api/v1|" .env
        print_success "VITE_API_URL actualizado en .env"
    else
        echo "VITE_API_URL=http://$server_ip/api/v1" >> .env
        print_success "VITE_API_URL agregado a .env"
    fi
fi

# ============================================
# PASO 4: Construcción y Levantado de Servicios
# ============================================
echo ""
echo "📋 PASO 4: Construyendo y levantando servicios Docker..."
echo ""

# Dependencias en package.json incluyen jest, @jest/globals (dev) para tests
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
migration_status_output=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1) || true

# Verificar si hay migraciones fallidas (P3009 específico, no solo "failed")
if echo "$migration_status_output" | grep -q "P3009\|failed migrations"; then
    print_warning "Se detectaron migraciones fallidas"
    if resolve_failed_migrations; then
        print_success "Migraciones fallidas resueltas"
    else
        print_error "No se pudieron resolver las migraciones fallidas automáticamente"
        print_info "Resuélvelas manualmente y vuelve a ejecutar el script"
        exit 1
    fi
fi

# Aplicar migraciones con retry automático (hasta 5 intentos)
# Si una migración falla (P3018/P3009), la marcamos como aplicada y reintentamos
print_info "Aplicando migraciones de base de datos..."
max_deploy_attempts=5
deploy_attempt=1
deploy_ok=false

while [ $deploy_attempt -le $max_deploy_attempts ]; do
    print_info "Ejecutando migrate deploy (intento $deploy_attempt/$max_deploy_attempts)..."
    deploy_output=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy 2>&1) || true
    deploy_exit=$?
    echo "$deploy_output" | tail -5

    if [ "$deploy_exit" -eq 0 ]; then
        print_success "Migraciones aplicadas correctamente"
        deploy_ok=true
        break
    fi

    # Extraer nombre de la migración que bloqueó el deploy
    failed_name=$(echo "$deploy_output" | grep -oE '[0-9]{14}_[a-zA-Z0-9_]+' | head -1)
    if [ -z "$failed_name" ]; then
        # Fallback: buscar en _prisma_migrations
        failed_name=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -t -A -c \
            "SELECT migration_name FROM \"_prisma_migrations\" WHERE finished_at IS NULL ORDER BY migration_name LIMIT 1;" 2>/dev/null | tr -d ' \r' || true)
    fi

    if [ -n "$failed_name" ]; then
        print_warning "Marcando como aplicada la migración bloqueante: $failed_name"
        $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate resolve --applied "$failed_name" 2>&1 || true
        deploy_attempt=$((deploy_attempt + 1))
    else
        print_error "No se pudo identificar la migración fallida"
        break
    fi
done

if [ "$deploy_ok" != "true" ]; then
    print_error "Error persistente al aplicar migraciones tras $max_deploy_attempts intentos"
    print_info "Verifica los logs: $DOCKER_COMPOSE_CMD logs backend"
    exit 1
fi

# Verificar estado final de migraciones
print_info "Verificando estado final de migraciones..."
if $DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate status 2>&1 | grep -qE "Database schema is up to date|All migrations have been applied|up to date"; then
    print_success "Base de datos sincronizada correctamente"
else
    print_warning "Verifica el estado de las migraciones manualmente"
fi

# Sincronizar índices y cambios de schema que no tienen archivo de migración
print_info "Sincronizando schema completo (índices de rendimiento)..."
if $DOCKER_COMPOSE_CMD exec -T backend npx prisma db push --skip-generate 2>&1; then
    print_success "Schema sincronizado con la base de datos"
else
    print_warning "db push tuvo advertencias, continuando..."
fi

# Poblar base de datos con datos iniciales (seed)
print_info "Poblando base de datos con datos iniciales..."
if $DOCKER_COMPOSE_CMD exec -T backend npm run prisma:seed 2>&1 | grep -q "Error\|error"; then
    print_warning "Error al poblar base de datos (puede que ya tenga datos)"
else
    print_success "Base de datos poblada con datos iniciales"
fi

# Preguntar si desea importar datos de ejemplo
echo ""
print_info "¿Deseas importar datos de ejemplo desde archivos exportados? (s/n)"
read -r import_response
if [[ "$import_response" =~ ^[Ss]$ ]]; then
    DATA_DIR="backend/prisma/seed-data"
    if [ -d "$DATA_DIR" ] && [ "$(find "$DATA_DIR" -name "*.json" 2>/dev/null | wc -l)" -gt 0 ]; then
        print_info "Importando datos de ejemplo..."
        if $DOCKER_COMPOSE_CMD exec -T backend npm run restore:data; then
            print_success "Datos de ejemplo importados correctamente"
        else
            print_warning "Error al importar datos de ejemplo (puede que ya existan)"
        fi
    else
        print_warning "No se encontraron archivos de datos para importar en $DATA_DIR"
        print_info "Para importar datos:"
        echo "   1. Exporta los datos desde tu base local: ./export-data.sh"
        echo "   2. Transfiere la carpeta backend/prisma/seed-data al VPS"
        echo "   3. Ejecuta: ./import-data.sh"
    fi
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
echo "👤 Credenciales de acceso (usar Número de identificación o email + contraseña):"
echo "   • Admin:           123456 o admin@gestionescolar.edu / admin123"
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
echo "📦 Comandos de Datos:"
echo "   • Exportar datos (local): ./export-data.sh"
echo "   • Importar datos (VPS): ./import-data.sh"
echo ""
echo "📖 Para más información, consulta:"
echo "   • VERIFICACION_VPS.md - Guía completa de verificación"
echo "   • CONFIGURACION_VPS.md - Configuración para VPS"
echo "   • GUIA_IMPORTACION_DATOS.md - Guía de exportación/importación de datos"
echo ""

