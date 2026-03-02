-- CreateTable
-- Tabla niveles: nombre_nivel (string) y numero_horas_clases (int) por institución
CREATE TABLE "niveles" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre_nivel" TEXT NOT NULL,
    "numero_horas_clases" INTEGER NOT NULL,
    "institucion_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "niveles_pkey" PRIMARY KEY ("id")
);

-- Unique por institución y nombre
CREATE UNIQUE INDEX "niveles_institucion_id_nombre_nivel_key" ON "niveles"("institucion_id", "nombre_nivel");

-- FK a institutions
ALTER TABLE "niveles" ADD CONSTRAINT "niveles_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable courses: agregar nivel_id y permitir nivel NULL (para migración posterior)
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "nivel_id" TEXT;

ALTER TABLE "courses" ALTER COLUMN "nivel" DROP NOT NULL;

ALTER TABLE "courses" ADD CONSTRAINT "courses_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "niveles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
