# Etapa 1: Construcción
FROM node:20-alpine as build

# Aceptar argumento de build para VITE_API_URL (se pasa desde docker-compose)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

# Copiar solo archivos de dependencias primero (mejor caché)
COPY package*.json ./

# Instalar dependencias (se cachará si no cambian package*.json)
# Usar npm ci para instalación determinista y más rápida
RUN npm ci --prefer-offline --no-audit

# Copiar el resto del código fuente (solo se reconstruye si cambia el código)
COPY . .

# Build de la aplicación (solo se ejecuta si cambia el código fuente)
RUN npm run build

# Etapa 2: Servidor Producción (Nginx)
FROM nginx:alpine

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos construidos desde la etapa anterior
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
