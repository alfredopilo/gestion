#!/bin/bash

# Colores para los mensajes
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}⬇️  Descargando últimos cambios de Git...${NC}"
git pull

echo -e "${GREEN}🐳 Reconstruyendo y reiniciando contenedores...${NC}"
# --build asegura que se instalen nuevas dependencias si package.json cambió
docker-compose up -d --build

echo -e "${GREEN}⏳ Esperando a que el backend inicie...${NC}"
sleep 10

echo -e "${GREEN}🗄️  Aplicando migraciones de base de datos...${NC}"
# Usamos -T para evitar errores de terminal en scripts
docker-compose exec -T backend npm run prisma:migrate:deploy

echo -e "${GREEN}🔄 Regenerando cliente Prisma...${NC}"
docker-compose exec -T backend npm run prisma:generate

echo -e "${GREEN}🧹 Limpiando imágenes antiguas de Docker (opcional)...${NC}"
docker image prune -f

echo -e "${GREEN}✅ ¡Actualización completada exitosamente!${NC}"

