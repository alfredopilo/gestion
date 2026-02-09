# Etapa 1: Instalación de dependencias (caché si no cambian package*.json)
FROM node:20-alpine AS deps

# Instalar dependencias del sistema necesarias para Prisma y bcrypt
RUN apk add --no-cache openssl openssl-dev libc6-compat postgresql-client

WORKDIR /app

# Copiar solo archivos de dependencias primero (mejor caché)
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias (caché de capas + caché de npm en el host para VPS más rápido)
# --mount=type=cache reutiliza el directorio npm entre builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --only=production

# Generar el cliente de Prisma (se cachará si no cambia schema.prisma)
RUN npx prisma generate

# Etapa 2: Imagen final (solo se reconstruye si cambia el código)
FROM node:20-alpine

# Instalar dependencias del sistema necesarias para runtime
RUN apk add --no-cache openssl libc6-compat postgresql-client

WORKDIR /app

# Copiar solo dependencias instaladas y Prisma generado desde la etapa anterior
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/prisma ./prisma

# Copiar el código fuente (solo se reconstruye si cambia el código)
COPY . .

EXPOSE 3000

# Usar node directo en lugar de nodemon para producción
CMD ["node", "src/server.js"]
