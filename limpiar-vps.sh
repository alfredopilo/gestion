#!/bin/bash
#
# Script para borrar TODO lo referente a Gestión Escolar en el VPS.
# Deja el sistema limpio para una instalación desde cero.
# Ejecutar desde la carpeta del proyecto (donde está docker-compose.yml).
#

set -e

echo "=============================================="
echo "  Limpieza completa - Gestión Escolar (VPS)"
echo "=============================================="
echo ""

# Colores
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  Esto va a:${NC}"
echo "   - Detener y eliminar contenedores (backend, frontend, postgres)"
echo "   - Eliminar volúmenes (incluida la base de datos)"
echo "   - Eliminar imágenes Docker del proyecto"
echo "   - Eliminar la red del proyecto"
echo ""
read -p "¿Continuar? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

# 1. Ir al directorio del proyecto si existe docker-compose
if [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}►${NC} Deteniendo contenedores y eliminando volúmenes..."
    docker compose down -v --remove-orphans
    echo -e "${GREEN}✅${NC} Contenedores y volúmenes eliminados."
else
    echo -e "${YELLOW}►${NC} No se encontró docker-compose.yml aquí. Ejecuta este script desde la carpeta del proyecto."
fi

# 2. Eliminar imágenes del proyecto (por nombre)
echo ""
echo -e "${GREEN}►${NC} Eliminando imágenes Docker del proyecto..."
for img in gestion-escolar-backend gestion-escolar-frontend gestion-escolar-db; do
    if docker images -q "$img" 2>/dev/null | grep -q .; then
        docker rmi -f "$img" 2>/dev/null || true
        echo "   Eliminada: $img"
    fi
done
# Imágenes construidas por compose suelen tener el prefijo del directorio
docker images | grep -E "gestion-escolar|gestionescolar" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
echo -e "${GREEN}✅${NC} Imágenes eliminadas."

# 3. Red (normalmente se elimina con compose down)
docker network rm gestion-escolar_gestion-escolar-network 2>/dev/null || true
docker network rm gestion-escolar-network 2>/dev/null || true
echo -e "${GREEN}✅${NC} Red eliminada (si existía)."

echo ""
echo -e "${GREEN}=============================================="
echo "  Limpieza completada."
echo "==============================================${NC}"
echo ""
echo "Para una instalación limpia:"
echo "  1. Si quieres borrar también la carpeta del código:"
echo "     cd .. && rm -rf $(basename "$(pwd)")"
echo "  2. Clonar de nuevo: git clone https://github.com/alfredopilo/gestion.git"
echo "  3. cd gestion && chmod +x install.sh && ./install.sh"
echo ""
