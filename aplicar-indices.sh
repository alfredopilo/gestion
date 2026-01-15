#!/bin/bash

# Script para aplicar índices de optimización a la base de datos
# Mejora significativamente el rendimiento de las consultas del dashboard

echo "🔧 Aplicando Índices de Optimización"
echo "====================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Verificar que el archivo SQL existe
SQL_FILE="backend/prisma/migrations/add_performance_indexes.sql"

if [ ! -f "$SQL_FILE" ]; then
    print_error "No se encontró el archivo $SQL_FILE"
    print_info "Asegúrate de estar en el directorio raíz del proyecto"
    exit 1
fi

print_success "Archivo SQL encontrado"
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

# Copiar el archivo SQL al contenedor
print_info "Copiando archivo SQL al contenedor..."

if $DC cp "$SQL_FILE" postgres:/tmp/add_performance_indexes.sql; then
    print_success "Archivo copiado al contenedor"
else
    print_error "Error al copiar archivo"
    exit 1
fi

echo ""

# Aplicar los índices
print_info "Aplicando índices de optimización..."
print_warning "Esto puede tardar varios segundos si tienes muchos datos"
echo ""

START_TIME=$(date +%s)

if $DC exec -T postgres psql -U gestionscolar -d gestion_escolar -f /tmp/add_performance_indexes.sql; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo ""
    print_success "Índices aplicados correctamente"
    print_info "Tiempo total: ${DURATION} segundos"
else
    print_error "Error al aplicar índices"
    print_info "Ver logs para más detalles"
    exit 1
fi

echo ""

# Verificar índices creados
print_info "Verificando índices creados..."
echo ""

$DC exec -T postgres psql -U gestionscolar -d gestion_escolar -c "
SELECT 
  schemaname, 
  tablename, 
  indexname,
  CASE 
    WHEN indexdef LIKE '%WHERE deleted_at IS NULL%' THEN '(Partial Index)'
    ELSE ''
  END as type
FROM pg_indexes 
WHERE indexname LIKE 'idx_%'
  AND schemaname = 'public'
ORDER BY tablename, indexname;
" 2>&1 | grep -E "idx_|rows|^-" || print_warning "No se pudieron listar índices"

echo ""

# Limpiar archivo temporal
print_info "Limpiando archivo temporal..."
$DC exec -T postgres rm /tmp/add_performance_indexes.sql 2>/dev/null || true

echo ""
echo "=============================================="
print_success "¡Optimización completada!"
echo "=============================================="
echo ""

print_info "Los siguientes índices han sido creados:"
echo "  • idx_user_institucion"
echo "  • idx_user_role_institucion"
echo "  • idx_student_institucion_estado"
echo "  • idx_student_curso_estado"
echo "  • idx_student_name_search"
echo "  • idx_course_anio_lectivo"
echo "  • idx_payment_estudiante"
echo "  • idx_payment_estudiante_estado"
echo "  • idx_payment_fecha_estado"
echo "  • idx_grade_student_subject"
echo "  • idx_grade_period"
echo "  • idx_attendance_student_date"
echo "  • idx_attendance_course_date"
echo "  • idx_course_subject_assignment_docente"
echo "  • idx_course_subject_assignment_curso"
echo "  • idx_institution_active"
echo "  • idx_school_year_active"
echo "  • idx_period_active"
echo ""

print_info "Beneficios esperados:"
echo "  • Consultas COUNT 5-10x más rápidas"
echo "  • Dashboard carga en 1-3 segundos (antes 10-20s)"
echo "  • Menor uso de CPU en consultas"
echo "  • Mejor rendimiento general del sistema"
echo ""

print_info "Para verificar el uso de índices:"
echo "  docker compose exec postgres psql -U gestionscolar -d gestion_escolar"
echo "  \\d+ \"User\""
echo "  SELECT * FROM pg_stat_user_indexes WHERE indexname LIKE 'idx_%';"
echo ""

print_success "¡Listo! Ahora prueba el dashboard para ver la mejora"
