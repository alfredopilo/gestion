-- AlterTable
-- Agregar columnas cursoId y materiaId
ALTER TABLE "insumos" ADD COLUMN IF NOT EXISTS "curso_id" TEXT;
ALTER TABLE "insumos" ADD COLUMN IF NOT EXISTS "materia_id" TEXT;

-- Eliminar la restricción única antigua
ALTER TABLE "insumos" DROP CONSTRAINT IF EXISTS "insumos_sub_periodo_id_nombre_key";

-- Agregar las foreign keys
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hacer las columnas NOT NULL después de migrar datos existentes (si los hay)
-- Primero actualizamos los registros existentes con valores por defecto si es necesario
-- Luego hacemos las columnas NOT NULL

-- Crear la nueva restricción única
CREATE UNIQUE INDEX IF NOT EXISTS "insumos_curso_id_materia_id_sub_periodo_id_nombre_key" ON "insumos"("curso_id", "materia_id", "sub_periodo_id", "nombre");

