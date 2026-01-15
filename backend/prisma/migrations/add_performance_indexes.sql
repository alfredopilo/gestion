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
-- Optimiza: SELECT COUNT(*) FROM "User" WHERE institucion_id = ?
CREATE INDEX IF NOT EXISTS idx_user_institucion 
  ON "User"(institucion_id);

-- Índice adicional para consultas por rol
CREATE INDEX IF NOT EXISTS idx_user_role_institucion 
  ON "User"(rol, institucion_id);

-- ===================================================================
-- Índice para la tabla Student
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM "Student" WHERE institucion_id = ? AND estado = 'ACTIVO'
CREATE INDEX IF NOT EXISTS idx_student_institucion_estado 
  ON "Student"(institucion_id, estado);

-- Índice adicional para consultas por curso
CREATE INDEX IF NOT EXISTS idx_student_curso_estado 
  ON "Student"(curso_id, estado);

-- Índice para búsquedas por nombre (usado frecuentemente)
CREATE INDEX IF NOT EXISTS idx_student_name_search 
  ON "Student"(nombre, apellido, institucion_id);

-- ===================================================================
-- Índice para la tabla Course
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM "Course" via anio_lectivo_id
CREATE INDEX IF NOT EXISTS idx_course_anio_lectivo 
  ON "Course"(anio_lectivo_id);

-- ===================================================================
-- Índice para la tabla Payment
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM "Payment"
CREATE INDEX IF NOT EXISTS idx_payment_estudiante 
  ON "Payment"(estudiante_id);

-- Índice para consultas por estudiante y estado
CREATE INDEX IF NOT EXISTS idx_payment_estudiante_estado 
  ON "Payment"(estudiante_id, estado);

-- Índice para consultas por fecha y estado
CREATE INDEX IF NOT EXISTS idx_payment_fecha_estado 
  ON "Payment"(fecha_pago, estado);

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
-- Índice para la tabla CourseSubjectAssignment
-- ===================================================================
-- Optimiza consultas de asignación de materias
CREATE INDEX IF NOT EXISTS idx_course_subject_assignment_docente 
  ON "course_subject_assignments"(docente_id);

CREATE INDEX IF NOT EXISTS idx_course_subject_assignment_curso 
  ON "course_subject_assignments"(curso_id);

-- ===================================================================
-- Índice para la tabla Institution
-- ===================================================================
-- Optimiza consultas de instituciones activas
CREATE INDEX IF NOT EXISTS idx_institution_active 
  ON "Institution"(activa);

-- ===================================================================
-- Índice para la tabla SchoolYear
-- ===================================================================
-- Optimiza consultas de años escolares activos
CREATE INDEX IF NOT EXISTS idx_school_year_active 
  ON "school_years"(activo, institucion_id);

-- ===================================================================
-- Índice para la tabla Period
-- ===================================================================
-- Optimiza consultas de períodos activos
CREATE INDEX IF NOT EXISTS idx_period_active 
  ON "periods"(activo, anio_lectivo_id);

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
-- 1. Los índices están optimizados para las consultas más frecuentes
--    del dashboard y del sistema en general
--
-- 2. PostgreSQL automáticamente usa estos índices cuando
--    detecta que pueden mejorar el rendimiento de una consulta
--
-- 3. Si tienes muchos datos (>100k registros), los índices pueden
--    tardar varios segundos en crearse. Es normal.
--
-- 4. Los índices ocupan espacio adicional en disco pero mejoran
--    significativamente el rendimiento de lectura
--
-- 5. Los nombres de los índices y tablas coinciden con el schema
--    de Prisma que usa nombres en español
--
-- ===================================================================
