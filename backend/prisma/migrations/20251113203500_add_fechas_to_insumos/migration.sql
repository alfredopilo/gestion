-- AlterTable
-- Agregar columna fecha_deber con valor por defecto
ALTER TABLE "insumos" ADD COLUMN IF NOT EXISTS "fecha_deber" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Agregar columna fecha_entrega (opcional)
ALTER TABLE "insumos" ADD COLUMN IF NOT EXISTS "fecha_entrega" TIMESTAMP(3);

