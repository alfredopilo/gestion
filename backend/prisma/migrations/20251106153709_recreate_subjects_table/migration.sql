-- Eliminar las foreign keys que dependen de subjects
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'grades_materia_id_fkey') THEN
        ALTER TABLE "grades" DROP CONSTRAINT "grades_materia_id_fkey";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'course_subject_assignments_materia_id_fkey') THEN
        ALTER TABLE "course_subject_assignments" DROP CONSTRAINT "course_subject_assignments_materia_id_fkey";
    END IF;
END $$;

-- Eliminar todas las constraints de subjects antes de eliminar la tabla
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subjects') THEN
        -- Eliminar foreign keys de subjects
        ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "subjects_institucion_id_fkey";
        ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "subjects_anio_lectivo_id_fkey";
        ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "subjects_curso_id_fkey";
        ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "subjects_docente_id_fkey";
        
        -- Eliminar índices únicos
        DROP INDEX IF EXISTS "subjects_codigo_institucion_id_anio_lectivo_id_key";
        DROP INDEX IF EXISTS "subjects_codigo_key";
        
        -- Eliminar la tabla
        DROP TABLE "subjects" CASCADE;
    END IF;
END $$;

-- Recrear la tabla subjects con los nuevos campos
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "creditos" INTEGER DEFAULT 1,
    "horas" INTEGER,
    "institucion_id" TEXT NOT NULL,
    "anio_lectivo_id" TEXT NOT NULL,
    "curso_id" TEXT,
    "docente_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- Crear índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_codigo_institucion_id_anio_lectivo_id_key" ON "subjects"("codigo", "institucion_id", "anio_lectivo_id");

-- Crear foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subjects_institucion_id_fkey') THEN
        ALTER TABLE "subjects" ADD CONSTRAINT "subjects_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subjects_anio_lectivo_id_fkey') THEN
        ALTER TABLE "subjects" ADD CONSTRAINT "subjects_anio_lectivo_id_fkey" FOREIGN KEY ("anio_lectivo_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subjects_curso_id_fkey') THEN
        ALTER TABLE "subjects" ADD CONSTRAINT "subjects_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subjects_docente_id_fkey') THEN
        ALTER TABLE "subjects" ADD CONSTRAINT "subjects_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Recrear las foreign keys de las tablas dependientes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'grades_materia_id_fkey') THEN
        ALTER TABLE "grades" ADD CONSTRAINT "grades_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'course_subject_assignments_materia_id_fkey') THEN
        ALTER TABLE "course_subject_assignments" ADD CONSTRAINT "course_subject_assignments_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

