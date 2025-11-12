-- AlterTable: Agregar columnas institucion_id y anio_lectivo_id a subjects
-- Primero eliminamos el constraint único actual de codigo si existe
ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "subjects_codigo_key";

-- Agregar las nuevas columnas como nullable primero (para manejar datos existentes)
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "institucion_id" TEXT;
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "anio_lectivo_id" TEXT;

-- Si hay datos existentes, asignarles valores de la primera institución y año lectivo activo
-- Obtener la primera institución disponible
DO $$
DECLARE
    v_institucion_id TEXT;
    v_anio_lectivo_id TEXT;
BEGIN
    -- Obtener la primera institución (o la activa si existe)
    SELECT id INTO v_institucion_id 
    FROM institutions 
    WHERE activa = true 
    LIMIT 1;
    
    -- Si no hay institución activa, obtener la primera disponible
    IF v_institucion_id IS NULL THEN
        SELECT id INTO v_institucion_id 
        FROM institutions 
        LIMIT 1;
    END IF;
    
    -- Obtener el año lectivo activo de la institución
    IF v_institucion_id IS NOT NULL THEN
        SELECT id INTO v_anio_lectivo_id 
        FROM school_years 
        WHERE institucion_id = v_institucion_id AND activo = true 
        LIMIT 1;
        
        -- Si no hay año activo, obtener el primero de la institución
        IF v_anio_lectivo_id IS NULL THEN
            SELECT id INTO v_anio_lectivo_id 
            FROM school_years 
            WHERE institucion_id = v_institucion_id 
            ORDER BY created_at DESC 
            LIMIT 1;
        END IF;
    END IF;
    
    -- Si tenemos valores válidos, actualizar los registros existentes
    IF v_institucion_id IS NOT NULL AND v_anio_lectivo_id IS NOT NULL THEN
        UPDATE "subjects" 
        SET "institucion_id" = v_institucion_id,
            "anio_lectivo_id" = v_anio_lectivo_id
        WHERE "institucion_id" IS NULL OR "anio_lectivo_id" IS NULL;
    ELSE
        -- Si no hay institución o año lectivo, eliminar los registros
        -- (solo si no hay datos importantes)
        DELETE FROM "subjects" WHERE "institucion_id" IS NULL OR "anio_lectivo_id" IS NULL;
    END IF;
END $$;

-- Ahora hacer las columnas NOT NULL
ALTER TABLE "subjects" ALTER COLUMN "institucion_id" SET NOT NULL;
ALTER TABLE "subjects" ALTER COLUMN "anio_lectivo_id" SET NOT NULL;

-- Agregar las foreign keys
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_institucion_id_fkey" 
  FOREIGN KEY ("institucion_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subjects" ADD CONSTRAINT "subjects_anio_lectivo_id_fkey" 
  FOREIGN KEY ("anio_lectivo_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Crear el nuevo constraint único compuesto
CREATE UNIQUE INDEX "subjects_codigo_institucion_id_anio_lectivo_id_key" 
  ON "subjects"("codigo", "institucion_id", "anio_lectivo_id");

