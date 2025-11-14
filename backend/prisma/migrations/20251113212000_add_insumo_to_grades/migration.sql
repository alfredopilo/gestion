-- AlterTable
-- Agregar columna insumo_id
ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "insumo_id" TEXT;

-- Agregar foreign key
ALTER TABLE "grades" ADD CONSTRAINT "grades_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Crear índice único para estudiante e insumo
CREATE UNIQUE INDEX IF NOT EXISTS "grades_estudiante_id_insumo_id_key" ON "grades"("estudiante_id", "insumo_id");

-- Crear índice adicional para búsquedas
CREATE INDEX IF NOT EXISTS "grades_estudiante_id_insumo_id_idx" ON "grades"("estudiante_id", "insumo_id");

