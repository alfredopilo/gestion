#!/bin/bash

# Script para restaurar un backup de PostgreSQL
# Uso: ./restaurar-backup.sh [ruta/al/archivo.sql.gz] [--force]
# --force: Saltar confirmación (usar con cuidado)

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Detectar docker compose
if command -v docker-compose &> /dev/null; then
    DC="docker-compose"
else
    DC="docker compose"
fi

echo "🔄 Restauración de Backup de Base de Datos"
echo "=========================================="
echo ""

# Verificar parámetros
FORCE=false
BACKUP_FILE=""

for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE=true
    elif [ -z "$BACKUP_FILE" ]; then
        BACKUP_FILE="$arg"
    fi
done

# Si no se especificó archivo, usar el default
if [ -z "$BACKUP_FILE" ]; then
    BACKUP_FILE="bak/backup_gestion_escolar_2026-01-15T23-24-05.sql.gz"
    print_warning "No se especificó archivo, usando: $BACKUP_FILE"
fi

# Verificar que el archivo existe
if [ ! -f "$BACKUP_FILE" ]; then
    print_error "El archivo no existe: $BACKUP_FILE"
    exit 1
fi

print_success "Archivo de backup encontrado: $BACKUP_FILE"
echo ""

# Verificar que PostgreSQL está corriendo
print_info "Verificando que PostgreSQL esté corriendo..."

if ! $DC ps postgres | grep -q "Up"; then
    print_error "PostgreSQL no está corriendo"
    print_info "Inicia los servicios con: $DC up -d"
    exit 1
fi

print_success "PostgreSQL está corriendo"
echo ""

# Confirmar antes de restaurar (si no se usa --force)
if [ "$FORCE" = false ]; then
    print_warning "⚠️  ADVERTENCIA: Esta acción reemplazará TODOS los datos actuales"
    print_warning "⚠️  de la base de datos. Esta acción NO se puede deshacer."
    echo ""
    read -p "¿Estás seguro de que deseas continuar? (escribe 'SI' para confirmar): " confirmation

    if [ "$confirmation" != "SI" ]; then
        print_info "Operación cancelada por el usuario"
        exit 0
    fi
else
    print_warning "Modo --force activado, saltando confirmación"
fi

echo ""
print_info "Iniciando restauración..."
echo ""

# Paso 1: Limpiar la base de datos actual
print_info "Paso 1/3: Limpiando base de datos actual..."

# Desactivar foreign keys y eliminar todo
$DC exec -T postgres psql -U gestionscolar -d gestion_escolar -c "
-- Desactivar foreign keys temporalmente
SET session_replication_role = 'replica';

-- Obtener lista de todas las tablas
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END\$\$;

-- Reactivar foreign keys
SET session_replication_role = 'origin';
" > /dev/null 2>&1

print_success "Base de datos limpiada"
echo ""

# Guardar timestamp de inicio
START_TIME=$(date +%s)

print_info "Paso 2/3: Descomprimiendo y filtrando backup..."

# Crear archivo temporal filtrado
TEMP_SQL="/tmp/restore_filtered_$(date +%s).sql"

# Paso 2: Descomprimir y filtrar
if [[ "$BACKUP_FILE" == *.gz ]]; then
    # Descomprimir y filtrar comandos problemáticos
    gunzip -c "$BACKUP_FILE" | grep -v "^SET transaction_timeout" | grep -v "^SET idle_in_transaction_session_timeout" | grep -v "^SET lock_timeout" > "$TEMP_SQL"
else
    cat "$BACKUP_FILE" | grep -v "^SET transaction_timeout" | grep -v "^SET idle_in_transaction_session_timeout" | grep -v "^SET lock_timeout" > "$TEMP_SQL"
fi

print_success "Backup descomprimido y filtrado"
echo ""

print_info "Paso 3/3: Restaurando datos..."
echo ""

# Paso 3: Restaurar con foreign keys desactivadas
# Crear el script SQL con comandos de configuración
{
    echo "-- Desactivar foreign keys y restricciones temporalmente"
    echo "SET session_replication_role = 'replica';"
    echo "SET client_min_messages = warning;"
    echo ""
    cat "$TEMP_SQL"
    echo ""
    echo "-- Reactivar foreign keys y restricciones"
    echo "SET session_replication_role = 'origin';"
    echo "SET client_min_messages = notice;"
} | $DC exec -T postgres psql -U gestionscolar -d gestion_escolar 2>&1 > /tmp/restore_output.log

EXIT_CODE=$?
ERROR_OUTPUT=$(cat /tmp/restore_output.log)

# Limpiar archivos temporales
rm -f "$TEMP_SQL"
rm -f /tmp/restore_output.log

# Analizar resultado
if [ $EXIT_CODE -eq 0 ]; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    # Filtrar solo errores reales (ignorar warnings, notices y errores esperados)
    REAL_ERRORS=$(echo "$ERROR_OUTPUT" | grep "ERROR:" | grep -v "does not exist" | grep -v "already exists" | grep -v "unrecognized configuration parameter" | grep -v "type.*already exists" | grep -v "multiple primary keys")
    
    if [ -n "$REAL_ERRORS" ]; then
        echo ""
        print_warning "Restauración completada con algunas advertencias:"
        echo "$REAL_ERRORS" | head -5
        echo ""
    fi
    
    echo ""
    print_success "Backup restaurado exitosamente"
    print_info "Tiempo total: ${DURATION} segundos"
else
    print_error "Error al restaurar backup (código de salida: $EXIT_CODE)"
    echo ""
    print_error "Detalles del error:"
    echo "$ERROR_OUTPUT" | grep "ERROR:" | grep -v "already exists" | head -10
    exit 1
fi

echo ""
echo "=============================================="
print_success "¡Restauración completada!"
echo "=============================================="
echo ""

print_info "La base de datos ha sido restaurada desde el backup"
print_warning "Recuerda reiniciar el backend si está corriendo:"
echo "  $DC restart backend"
echo ""
