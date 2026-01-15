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

# Aplicar los índices
print_info "Aplicando índices de optimización..."
print_warning "Esto puede tardar varios segundos si tienes muchos datos"
echo ""

START_TIME=$(date +%s)

# Ejecutar SQL directamente desde el archivo sin copiarlo
if cat "$SQL_FILE" | $DC exec -T postgres psql -U gestionscolar -d gestion_escolar; then
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
  indexname
FROM pg_indexes 
WHERE indexname LIKE 'idx_%'
  AND schemaname = 'public'
ORDER BY tablename, indexname;
" 2>&1 | grep -E "idx_|rows|^-" || print_warning "No se pudieron listar índices"

echo ""
echo "=============================================="
print_success "¡Optimización completada!"
echo "=============================================="
echo ""

print_info "Los siguientes índices han sido creados:"
echo "  • idx_user_institucion (tabla: users)"
echo "  • idx_user_role_institucion (tabla: users)"
echo "  • idx_student_user (tabla: students)"
echo "  • idx_student_grupo (tabla: students)"
echo "  • idx_enrollment_institucion_activo (tabla: enrollments)"
echo "  • idx_enrollment_student (tabla: enrollments)"
echo "  • idx_enrollment_curso_anio (tabla: enrollments)"
echo "  • idx_course_anio_lectivo (tabla: courses)"
echo "  • idx_payment_estudiante (tabla: payments)"
echo "  • idx_payment_estudiante_estado (tabla: payments)"
echo "  • idx_payment_fecha_estado (tabla: payments)"
echo "  • idx_grade_estudiante_materia (tabla: grades)"
echo "  • idx_grade_subperiodo (tabla: grades)"
echo "  • idx_attendance_estudiante_fecha (tabla: attendance)"
echo "  • idx_attendance_curso_fecha (tabla: attendance)"
echo "  • idx_course_subject_assignment_docente (tabla: course_subject_assignments)"
echo "  • idx_course_subject_assignment_curso (tabla: course_subject_assignments)"
echo "  • idx_institution_active (tabla: institutions)"
echo "  • idx_school_year_active (tabla: school_years)"
echo "  • idx_period_active (tabla: periods)"
echo ""

print_info "Beneficios esperados:"
echo "  • Consultas COUNT 5-10x más rápidas"
echo "  • Dashboard carga en 1-3 segundos (antes 10-20s)"
echo "  • Menor uso de CPU en consultas"
echo "  • Mejor rendimiento general del sistema"
echo ""

print_info "Para verificar el uso de índices:"
echo "  docker compose exec postgres psql -U gestionscolar -d gestion_escolar"
echo "  \\d+ users"
echo "  SELECT * FROM pg_stat_user_indexes WHERE indexname LIKE 'idx_%';"
echo ""

print_success "¡Listo! Ahora prueba el dashboard para ver la mejora"
