FROM node:20-alpine

# Instalar OpenSSL, postgresql-client (para pg_dump) y otras dependencias necesarias para Prisma
RUN apk add --no-cache openssl openssl-dev libc6-compat postgresql-client

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Generar el cliente de Prisma tras copiar el esquema
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]

