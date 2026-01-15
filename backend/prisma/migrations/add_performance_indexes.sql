-- ===================================================================
-- Índices para Optimizar el Rendimiento del Dashboard
-- ===================================================================
-- Estos índices mejoran significativamente las consultas COUNT
-- que se usan en las estadísticas del dashboard

-- IMPORTANTE: Ejecutar estos comandos en la base de datos
-- Esto NO es una migración de Prisma, es SQL directo

-- ===================================================================
-- Índice para la tabla User
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM "User" WHERE institution_id = ? AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_user_institution_deleted 
  ON "User"(institution_id, deleted_at)
  WHERE deleted_at IS NULL;

-- Índice adicional para consultas por rol
CREATE INDEX IF NOT EXISTS idx_user_role_institution 
  ON "User"(role, institution_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ===================================================================
-- Índice para la tabla Student
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM "Student" WHERE institution_id = ? AND status = 'ACTIVO' AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_student_institution_status_deleted 
  ON "Student"(institution_id, status, deleted_at)
  WHERE deleted_at IS NULL;

-- Índice adicional para consultas por curso
CREATE INDEX IF NOT EXISTS idx_student_course_status 
  ON "Student"(course_id, status, deleted_at)
  WHERE deleted_at IS NULL;

-- Índice para búsquedas por nombre (usado frecuentemente)
CREATE INDEX IF NOT EXISTS idx_student_name_search 
  ON "Student"(first_name, last_name, institution_id)
  WHERE deleted_at IS NULL;

-- ===================================================================
-- Índice para la tabla Course
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM "Course" WHERE institution_id = ? AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_course_institution_deleted 
  ON "Course"(institution_id, deleted_at)
  WHERE deleted_at IS NULL;

-- Índice para consultas por año escolar
CREATE INDEX IF NOT EXISTS idx_course_school_year 
  ON "Course"(school_year_id, institution_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ===================================================================
-- Índice para la tabla Payment
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM "Payment" WHERE deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_payment_deleted 
  ON "Payment"(deleted_at)
  WHERE deleted_at IS NULL;

-- Índice para consultas por estudiante
CREATE INDEX IF NOT EXISTS idx_payment_student_status 
  ON "Payment"(student_id, status, deleted_at)
  WHERE deleted_at IS NULL;

-- Índice para consultas por fecha y estado
CREATE INDEX IF NOT EXISTS idx_payment_date_status 
  ON "Payment"(payment_date, status, deleted_at)
  WHERE deleted_at IS NULL;

-- ===================================================================
-- Índice para la tabla Grade
-- ===================================================================
-- Optimiza consultas de calificaciones
CREATE INDEX IF NOT EXISTS idx_grade_student_subject 
  ON "Grade"(student_id, subject_assignment_id);

CREATE INDEX IF NOT EXISTS idx_grade_period 
  ON "Grade"(period_id, student_id);

-- ===================================================================
-- Índice para la tabla Attendance
-- ===================================================================
-- Optimiza consultas de asistencia
CREATE INDEX IF NOT EXISTS idx_attendance_student_date 
  ON "Attendance"(student_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_course_date 
  ON "Attendance"(course_id, date);

-- ===================================================================
-- Índice para la tabla SubjectAssignment
-- ===================================================================
-- Optimiza consultas de asignación de materias
CREATE INDEX IF NOT EXISTS idx_subject_assignment_teacher 
  ON "SubjectAssignment"(teacher_id, deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subject_assignment_course 
  ON "SubjectAssignment"(course_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ===================================================================
-- Índice para la tabla Institution
-- ===================================================================
-- Optimiza consultas de instituciones activas
CREATE INDEX IF NOT EXISTS idx_institution_active 
  ON "Institution"(is_active, deleted_at)
  WHERE deleted_at IS NULL;

-- ===================================================================
-- Índice para la tabla SchoolYear
-- ===================================================================
-- Optimiza consultas de años escolares activos
CREATE INDEX IF NOT EXISTS idx_school_year_active 
  ON "SchoolYear"(is_active, institution_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ===================================================================
-- Índice para la tabla Period
-- ===================================================================
-- Optimiza consultas de períodos activos
CREATE INDEX IF NOT EXISTS idx_period_active 
  ON "Period"(is_active, school_year_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ===================================================================
-- VERIFICACIÓN DE ÍNDICES
-- ===================================================================
-- Para verificar que los índices se crearon correctamente:
-- SELECT schemaname, tablename, indexname, indexdef 
-- FROM pg_indexes 
-- WHERE indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- ===================================================================
-- ANÁLISIS DE RENDIMIENTO
-- ===================================================================
-- Para ver estadísticas de uso de índices:
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE indexname LIKE 'idx_%'
-- ORDER BY idx_scan DESC;

-- ===================================================================
-- NOTAS IMPORTANTES
-- ===================================================================
-- 1. Los índices WHERE deleted_at IS NULL son "partial indexes"
--    que solo indexan registros no eliminados (más eficiente)
--
-- 2. Los índices compuestos están optimizados para las consultas
--    más frecuentes del dashboard
--
-- 3. PostgreSQL automáticamente usa estos índices cuando
--    detecta que pueden mejorar el rendimiento de una consulta
--
-- 4. Si tienes muchos datos (>100k registros), los índices pueden
--    tardar varios segundos en crearse. Es normal.
--
-- 5. Los índices ocupan espacio adicional en disco pero mejoran
--    significativamente el rendimiento de lectura
--
-- ===================================================================
