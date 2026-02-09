-- Añadir columnas de curso, materia y archivo a mensajes (mensajes masivos por curso/materia)
-- IF NOT EXISTS para no fallar si ya se aplicó en otro entorno
ALTER TABLE "mensajes" ADD COLUMN IF NOT EXISTS "curso_id" TEXT;
ALTER TABLE "mensajes" ADD COLUMN IF NOT EXISTS "materia_id" TEXT;
ALTER TABLE "mensajes" ADD COLUMN IF NOT EXISTS "archivo_adjunto" TEXT;
