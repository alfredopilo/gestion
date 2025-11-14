-- CreateTable
CREATE TABLE "insumos" (
    "id" TEXT NOT NULL,
    "sub_periodo_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "insumos_sub_periodo_id_nombre_key" ON "insumos"("sub_periodo_id", "nombre");

-- AddForeignKey
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_sub_periodo_id_fkey" FOREIGN KEY ("sub_periodo_id") REFERENCES "sub_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

