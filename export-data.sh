#!/bin/bash

# Script para exportar datos de ejemplo desde la base de datos local
# Este script exporta todos los datos a archivos JSON que pueden ser importados en el VPS

set -e

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

# Verificar si es docker-compose o docker compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    DOCKER_COMPOSE_CMD="docker compose"
fi

echo "📦 Exportación de Datos de Ejemplo"
echo "===================================="
echo ""

# Verificar que Docker esté corriendo
if ! docker ps &> /dev/null; then
    print_error "Docker no está corriendo. Por favor inicia Docker."
    exit 1
fi

# Verificar que el contenedor del backend esté corriendo
if ! $DOCKER_COMPOSE_CMD ps | grep -q "gestion-escolar-backend.*Up"; then
    print_warning "El contenedor del backend no está corriendo"
    echo "   ¿Deseas iniciarlo? (s/n)"
    read -r response
    if [[ "$response" =~ ^[Ss]$ ]]; then
        print_info "Iniciando contenedores..."
        $DOCKER_COMPOSE_CMD up -d backend
        sleep 5
    else
        print_error "No se puede exportar sin el backend corriendo"
        exit 1
    fi
fi

# Verificar que PostgreSQL esté listo
print_info "Verificando conexión a la base de datos..."
if ! $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U gestionscolar &> /dev/null; then
    print_error "PostgreSQL no está disponible"
    exit 1
fi
print_success "Conexión a base de datos verificada"

# Exportar datos
print_info "Exportando datos desde la base de datos local..."
echo ""

if $DOCKER_COMPOSE_CMD exec -T backend npm run save:data; then
    print_success "Datos exportados correctamente"
else
    print_error "Error al exportar datos"
    exit 1
fi

# Verificar que se crearon los archivos
DATA_DIR="backend/prisma/seed-data"
if [ -d "$DATA_DIR" ]; then
    file_count=$(find "$DATA_DIR" -name "*.json" | wc -l)
    if [ "$file_count" -gt 0 ]; then
        print_success "Se exportaron $file_count archivos de datos"
        echo ""
        print_info "Archivos exportados en: $DATA_DIR"
        echo ""
        echo "📋 Archivos creados:"
        ls -lh "$DATA_DIR"/*.json 2>/dev/null | awk '{print "   - " $9 " (" $5 ")"}'
        echo ""
        print_info "Para importar estos datos en el VPS:"
        echo "   1. Sube la carpeta $DATA_DIR al VPS"
        echo "   2. Ejecuta en el VPS: ./import-data.sh"
        echo ""
        print_info "O comprime los datos para transferir:"
        echo "   tar -czf datos-exportados.tar.gz $DATA_DIR"
        echo "   scp datos-exportados.tar.gz usuario@VPS:/ruta/destino/"
    else
        print_warning "No se encontraron archivos JSON exportados"
    fi
else
    print_error "No se creó el directorio de datos exportados"
    exit 1
fi

echo ""
print_success "✅ Exportación completada!"
echo ""
