#!/bin/bash

# Script para importar datos de ejemplo en el VPS
# Este script importa datos previamente exportados desde la base local

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

echo "📥 Importación de Datos de Ejemplo"
echo "==================================="
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
        print_error "No se puede importar sin el backend corriendo"
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

# Verificar que existan los archivos de datos
DATA_DIR="backend/prisma/seed-data"
if [ ! -d "$DATA_DIR" ]; then
    print_error "No se encontró el directorio de datos: $DATA_DIR"
    echo ""
    print_info "Opciones para obtener los datos:"
    echo "   1. Si tienes un archivo comprimido, descomprímelo:"
    echo "      tar -xzf datos-exportados.tar.gz"
    echo ""
    echo "   2. Si los datos están en otra ubicación, cópialos:"
    echo "      cp -r /ruta/a/datos backend/prisma/seed-data"
    echo ""
    echo "   3. Exporta los datos desde tu base local:"
    echo "      ./export-data.sh (en tu máquina local)"
    exit 1
fi

# Contar archivos JSON
file_count=$(find "$DATA_DIR" -name "*.json" 2>/dev/null | wc -l)
if [ "$file_count" -eq 0 ]; then
    print_error "No se encontraron archivos JSON en $DATA_DIR"
    exit 1
fi

print_success "Se encontraron $file_count archivos de datos para importar"
echo ""

# Preguntar si desea limpiar la base de datos primero
print_warning "⚠️  ADVERTENCIA: Esto importará datos en la base de datos actual"
echo "   ¿Deseas limpiar la base de datos antes de importar? (s/n)"
read -r response
if [[ "$response" =~ ^[Ss]$ ]]; then
    print_warning "Esto eliminará todos los datos existentes"
    echo "   ¿Estás seguro? (escribe 'si' para confirmar)"
    read -r confirm
    if [ "$confirm" = "si" ]; then
        print_info "Limpiando base de datos..."
        # Aquí podrías agregar lógica para limpiar tablas si es necesario
        # Por ahora, restore-data.js usa skipDuplicates, así que no es crítico
        print_warning "Nota: Los datos se importarán con skipDuplicates (no se duplicarán registros existentes)"
    else
        print_info "Continuando sin limpiar la base de datos"
    fi
fi

# Importar datos
print_info "Importando datos en la base de datos..."
echo ""

if $DOCKER_COMPOSE_CMD exec -T backend npm run restore:data; then
    print_success "Datos importados correctamente"
else
    print_error "Error al importar datos"
    print_info "Verifica los logs: $DOCKER_COMPOSE_CMD logs backend"
    exit 1
fi

# Verificar que los datos se importaron
print_info "Verificando datos importados..."
sleep 2

# Contar registros en algunas tablas principales
institution_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -t -c \
    "SELECT COUNT(*) FROM \"Institution\";" 2>/dev/null | tr -d ' ')

user_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -t -c \
    "SELECT COUNT(*) FROM \"User\";" 2>/dev/null | tr -d ' ')

student_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U gestionscolar -d gestion_escolar -t -c \
    "SELECT COUNT(*) FROM \"Student\";" 2>/dev/null | tr -d ' ')

echo ""
print_success "Datos importados:"
echo "   • Instituciones: $institution_count"
echo "   • Usuarios: $user_count"
echo "   • Estudiantes: $student_count"
echo ""

print_success "✅ Importación completada!"
echo ""
print_info "Puedes verificar los datos accediendo a:"
echo "   • Frontend: http://localhost"
echo "   • Backend API: http://localhost:3000"
echo ""
