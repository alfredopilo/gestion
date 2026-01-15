-- ===================================================================
-- Índices para Optimizar el Rendimiento del Dashboard
-- ===================================================================
-- Estos índices mejoran significativamente las consultas COUNT
-- que se usan en las estadísticas del dashboard

-- IMPORTANTE: Ejecutar estos comandos en la base de datos
-- Esto NO es una migración de Prisma, es SQL directo

-- ===================================================================
-- Índice para la tabla users
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM users WHERE institucion_id = ?
CREATE INDEX IF NOT EXISTS idx_user_institucion 
  ON users(institucion_id);

-- Índice adicional para consultas por rol
CREATE INDEX IF NOT EXISTS idx_user_role_institucion 
  ON users(rol, institucion_id);

-- ===================================================================
-- Índice para la tabla students
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM students WHERE user_id IN (SELECT id FROM users WHERE institucion_id = ?)
CREATE INDEX IF NOT EXISTS idx_student_user 
  ON students(user_id);

-- Índice adicional para consultas por grupo
CREATE INDEX IF NOT EXISTS idx_student_grupo 
  ON students(grupo_id);

-- ===================================================================
-- Índice para la tabla enrollments (reemplaza student por institucion)
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM enrollments WHERE institucion_id = ? AND activo = true
CREATE INDEX IF NOT EXISTS idx_enrollment_institucion_activo 
  ON enrollments(institucion_id, activo);

-- Índice para consultas por estudiante
CREATE INDEX IF NOT EXISTS idx_enrollment_student 
  ON enrollments(student_id, activo);

-- Índice para consultas por curso y año lectivo
CREATE INDEX IF NOT EXISTS idx_enrollment_curso_anio 
  ON enrollments(curso_id, anio_lectivo_id);

-- ===================================================================
-- Índice para la tabla courses
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM courses via anio_lectivo_id
CREATE INDEX IF NOT EXISTS idx_course_anio_lectivo 
  ON courses(anio_lectivo_id);

-- ===================================================================
-- Índice para la tabla payments
-- ===================================================================
-- Optimiza: SELECT COUNT(*) FROM payments
CREATE INDEX IF NOT EXISTS idx_payment_estudiante 
  ON payments(estudiante_id);

-- Índice para consultas por estudiante y estado
CREATE INDEX IF NOT EXISTS idx_payment_estudiante_estado 
  ON payments(estudiante_id, estado);

-- Índice para consultas por fecha y estado
CREATE INDEX IF NOT EXISTS idx_payment_fecha_estado 
  ON payments(fecha_pago, estado);

-- ===================================================================
-- Índice para la tabla grades
-- ===================================================================
-- Optimiza consultas de calificaciones
CREATE INDEX IF NOT EXISTS idx_grade_estudiante_materia 
  ON grades(estudiante_id, materia_id);

CREATE INDEX IF NOT EXISTS idx_grade_subperiodo 
  ON grades(sub_periodo_id, estudiante_id);

-- ===================================================================
-- Índice para la tabla attendance
-- ===================================================================
-- Optimiza consultas de asistencia
CREATE INDEX IF NOT EXISTS idx_attendance_estudiante_fecha 
  ON attendance(estudiante_id, fecha);

CREATE INDEX IF NOT EXISTS idx_attendance_curso_fecha 
  ON attendance(curso_id, fecha);

-- ===================================================================
-- Índice para la tabla course_subject_assignments
-- ===================================================================
-- Optimiza consultas de asignación de materias
CREATE INDEX IF NOT EXISTS idx_course_subject_assignment_docente 
  ON course_subject_assignments(docente_id);

CREATE INDEX IF NOT EXISTS idx_course_subject_assignment_curso 
  ON course_subject_assignments(curso_id);

-- ===================================================================
-- Índice para la tabla institutions
-- ===================================================================
-- Optimiza consultas de instituciones activas
CREATE INDEX IF NOT EXISTS idx_institution_active 
  ON institutions(activa);

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
