FROM node:20-alpine

# Instalar dependencias del sistema necesarias para Prisma y bcrypt
RUN apk add --no-cache openssl openssl-dev libc6-compat postgresql-client

WORKDIR /app

COPY package*.json ./

# Instalar solo dependencias de producción
# Nota: npm ci requiere package-lock.json
RUN npm ci --only=production

COPY . .

# Generar el cliente de Prisma
RUN npx prisma generate

EXPOSE 3000

# Usar node directo en lugar de nodemon para producción
CMD ["node", "src/server.js"]
