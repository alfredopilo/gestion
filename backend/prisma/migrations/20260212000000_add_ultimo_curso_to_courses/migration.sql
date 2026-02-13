-- AlterTable
-- Agregar columna ultimo_curso a la tabla courses
-- Esta columna indica si el curso es el último grado escolar (no se promocionan estudiantes)
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "ultimo_curso" BOOLEAN NOT NULL DEFAULT false;
