-- AlterTable (IF NOT EXISTS para no fallar si la columna ya existe, p. ej. en VPS)
ALTER TABLE "school_years" ADD COLUMN IF NOT EXISTS "ano" INTEGER NOT NULL DEFAULT 2025;
