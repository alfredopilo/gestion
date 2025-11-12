-- Eliminar claves foráneas obsoletas de subjects
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'subjects_curso_id_fkey'
    ) THEN
        ALTER TABLE "subjects" DROP CONSTRAINT "subjects_curso_id_fkey";
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'subjects_docente_id_fkey'
    ) THEN
        ALTER TABLE "subjects" DROP CONSTRAINT "subjects_docente_id_fkey";
    END IF;
END $$;

-- Eliminar columnas que ya no se utilizan
ALTER TABLE "subjects"
    DROP COLUMN IF EXISTS "curso_id",
    DROP COLUMN IF EXISTS "docente_id";

