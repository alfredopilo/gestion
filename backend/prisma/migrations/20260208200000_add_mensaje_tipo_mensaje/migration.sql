-- Crear enum TipoMensaje si no existe (requerido para tipo_mensaje)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoMensaje') THEN
    CREATE TYPE "TipoMensaje" AS ENUM ('INDIVIDUAL', 'MASIVO_CURSO', 'MASIVO_MATERIA');
  END IF;
END
$$;

-- Añadir columnas a mensajes si no existen (evita error en VPS cuando la tabla ya existe sin ellas)
ALTER TABLE "mensajes" ADD COLUMN IF NOT EXISTS "tipo_mensaje" "TipoMensaje" NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "mensajes" ADD COLUMN IF NOT EXISTS "enviado_por_email" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "mensajes" ADD COLUMN IF NOT EXISTS "email_enviado" BOOLEAN NOT NULL DEFAULT false;
