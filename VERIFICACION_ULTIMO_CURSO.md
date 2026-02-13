# Verificación de Migración: Campo "ultimo_curso"

## Resumen de Cambios

### 1. Base de Datos
- **Schema Prisma**: Agregado campo `ultimoCurso Boolean @default(false) @map("ultimo_curso")` al modelo Course
- **Migración**: Creada `20260212000000_add_ultimo_curso_to_courses/migration.sql`
  - Comando SQL: `ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "ultimo_curso" BOOLEAN NOT NULL DEFAULT false;`
  - Usa `IF NOT EXISTS` para ser idempotente

### 2. Backend
- **Validadores** (`src/utils/validators.js`):
  - ✅ `createCourseSchema`: Agregado `ultimoCurso: z.boolean().optional()`
  - ✅ `updateCourseSchema`: Agregado `ultimoCurso: z.boolean().optional()`

- **Controlador de Cursos** (`src/controllers/courseController.js`):
  - ✅ `createCourse`: Incluye `ultimoCurso: validatedData.ultimoCurso ?? false` en courseData
  - ✅ `promoteStudents`: Rechaza con error 400 si `curso.ultimoCurso === true`
  - ✅ `importCourses`: Los cursos importados tienen `ultimoCurso: false` por defecto

- **Lógica de Promoción** (`src/utils/promotionLogic.js`):
  - ✅ `copyCourseToNewYear`: Incluye `ultimoCurso: course.ultimoCurso ?? false` al copiar cursos

### 3. Frontend
- **Courses.jsx**:
  - ✅ Estado `formData` incluye `ultimoCurso: false`
  - ✅ `handleEdit` carga `ultimoCurso: course.ultimoCurso ?? false`
  - ✅ `resetForm` reinicia `ultimoCurso: false`
  - ✅ Formulario modal incluye checkbox "Último curso" con texto explicativo

- **CourseDetail.jsx**:
  - ✅ Muestra sección "Último curso: Sí" cuando `course.ultimoCurso` es true
  - ✅ Botón "Promocionar Estudiantes" se oculta cuando `course.ultimoCurso === true`

### 4. Tests
- **ultimoCurso.test.js**: Tests unitarios para:
  - ✅ Validación de schema (create/update)
  - ✅ Lógica de negocio de promoción rechazada
  - ✅ Casos edge (undefined, false, true)

## Verificación de Scripts

### install.sh
**Líneas relevantes (PASO 6):**
```bash
print_info "Aplicando migraciones de base de datos..."
if $DOCKER_COMPOSE_CMD exec -T backend npm run prisma:migrate:deploy; then
    print_success "Migraciones aplicadas correctamente"
```

✅ **Verificado**: El script ejecuta `prisma migrate deploy` que aplicará automáticamente la migración `20260212000000_add_ultimo_curso_to_courses`.

### update.sh
**Líneas relevantes (PASO 3.5 y PASO 5):**
```bash
# PASO 3.5: Sincronizar Prisma del host al contenedor
if $DOCKER_COMPOSE_CMD cp backend/prisma/. backend:/app/prisma/ 2>/dev/null; then
    print_success "Carpeta prisma actualizada en el contenedor"

# PASO 5: Ejecutar migraciones pendientes
print_info "Ejecutando prisma migrate deploy..."
deploy_output=$($DOCKER_COMPOSE_CMD exec -T backend npx prisma migrate deploy 2>&1)
```

✅ **Verificado**: El script:
1. Copia la carpeta `prisma` completa (incluyendo nuevas migraciones) al contenedor
2. Ejecuta `migrate deploy` con manejo de errores y reintentos
3. Puede marcar migraciones fallidas como aplicadas si es necesario

## Compatibilidad y Seguridad

### Compatibilidad hacia atrás
✅ **Garantizada**:
- El campo `ultimo_curso` tiene `DEFAULT false` → cursos existentes no se ven afectados
- El campo es opcional en los schemas de validación
- La migración usa `IF NOT EXISTS` → puede ejecutarse múltiples veces sin error
- Frontend maneja valores undefined con `?? false`

### Datos existentes
- **Cursos existentes**: Recibirán automáticamente `ultimo_curso = false`
- **Lógica de promoción existente**: Funciona igual (false permite promoción)
- **Formularios**: Mostrarán checkbox desmarcado por defecto

### Rollback (si fuera necesario)
Si se necesitara revertir:
```sql
ALTER TABLE "courses" DROP COLUMN IF EXISTS "ultimo_curso";
```

## Pruebas Recomendadas Post-Deployment

1. **Crear curso nuevo**:
   - Verificar que el checkbox aparece
   - Crear con `ultimoCurso = true`
   - Confirmar que se guarda en BD

2. **Editar curso existente**:
   - Abrir curso existente (debe mostrar checkbox desmarcado)
   - Marcar checkbox
   - Guardar y verificar cambio

3. **Promoción rechazada**:
   - Curso con `ultimoCurso = true` y estudiantes
   - Intentar promocionar
   - Verificar mensaje de error 400

4. **Promoción permitida**:
   - Curso con `ultimoCurso = false` (o undefined)
   - Con curso siguiente configurado
   - Verificar que promoción funciona

5. **Copia a nuevo año**:
   - Usar función de promoción de año escolar
   - Verificar que cursos copiados mantienen `ultimoCurso`

## Estado de la Implementación

✅ **COMPLETADO**:
1. Schema Prisma + migración SQL
2. Validadores y controlador (create, update, promote, import) + promotionLogic
3. Frontend: Courses.jsx (formulario) y CourseDetail.jsx (vista y botón promoción)
4. Tests Jest para promoción rechazada y create/update
5. Verificación de install.sh y update.sh

**Fecha de implementación**: 2026-02-12
**Versión de migración**: 20260212000000_add_ultimo_curso_to_courses

---

## Comandos Útiles

### Aplicar migración en desarrollo local
```bash
cd backend
npx prisma migrate dev --name add_ultimo_curso_to_courses
```

### Aplicar migración en producción (VPS)
```bash
# Ya incluido en update.sh
./update.sh
```

### Ver estado de migraciones
```bash
docker-compose exec backend npx prisma migrate status
```

### Ejecutar tests
```bash
docker-compose exec backend npm test
```

### Verificar campo en BD
```bash
docker-compose exec postgres psql -U gestionscolar -d gestion_escolar -c "\d courses"
```
