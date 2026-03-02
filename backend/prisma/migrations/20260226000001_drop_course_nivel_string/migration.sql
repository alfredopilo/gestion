-- Migración de datos: crear niveles desde courses.nivel y enlazar curso -> nivel
-- Luego hace nivel_id obligatorio y elimina la columna legacy nivel

-- Insertar niveles únicos (institución, nombre) con numero_horas_clases por defecto 40
INSERT INTO "niveles" ("id", "nombre_nivel", "numero_horas_clases", "institucion_id", "created_at", "updated_at")
SELECT gen_random_uuid(), d.nombre_nivel, 40, d.institucion_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT s.institucion_id, COALESCE(NULLIF(TRIM(c.nivel), ''), 'Sin nivel') AS nombre_nivel
  FROM "courses" c
  JOIN "school_years" s ON s.id = c.anio_lectivo_id
) d
WHERE NOT EXISTS (
  SELECT 1 FROM "niveles" n
  WHERE n.institucion_id = d.institucion_id AND n.nombre_nivel = d.nombre_nivel
);

-- Asignar nivel_id a cada curso
UPDATE "courses" c
SET "nivel_id" = n.id
FROM "school_years" s, "niveles" n
WHERE c.anio_lectivo_id = s.id
  AND n.institucion_id = s.institucion_id
  AND n.nombre_nivel = COALESCE(NULLIF(TRIM(c.nivel), ''), 'Sin nivel')
  AND c.nivel_id IS NULL;

-- Asegurar que ningún curso quede sin nivel_id (por si no hubiera año lectivo)
UPDATE "courses" c
SET "nivel_id" = (SELECT id FROM "niveles" n WHERE n.institucion_id = (SELECT institucion_id FROM school_years WHERE id = c.anio_lectivo_id) AND n.nombre_nivel = 'Sin nivel' LIMIT 1)
WHERE c.nivel_id IS NULL
AND EXISTS (SELECT 1 FROM school_years WHERE id = c.anio_lectivo_id);

-- Hacer nivel_id obligatorio y eliminar columna nivel
ALTER TABLE "courses" ALTER COLUMN "nivel_id" SET NOT NULL;
ALTER TABLE "courses" DROP COLUMN IF EXISTS "nivel";
