#!/bin/bash

# Script para ver el error completo del backend en el VPS

echo "==================================================="
echo "  DIAGNÓSTICO COMPLETO DE ERRORES DEL BACKEND"
echo "==================================================="
echo ""

# Colores
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Detectar docker compose
if command -v docker-compose &> /dev/null; then
    DC="docker-compose"
else
    DC="docker compose"
fi

echo "1. ÚLTIMOS 100 LOGS DEL BACKEND"
echo "-----------------------------------"
$DC logs backend --tail=100

echo ""
echo ""
echo "2. SOLO ERRORES (últimas 50 líneas)"
echo "-----------------------------------"
$DC logs backend --tail=50 | grep -i "error" -A 5 -B 2 || echo "No se encontraron errores"

echo ""
echo ""
echo "3. ERRORES DE PRISMA"
echo "-----------------------------------"
$DC logs backend --tail=100 | grep -i "prisma" || echo "No hay errores de Prisma"

echo ""
echo ""
echo "4. ESTADO DEL CONTENEDOR"
echo "-----------------------------------"
$DC ps backend

echo ""
echo ""
echo "5. VERIFICAR SI EL BACKEND RESPONDE"
echo "-----------------------------------"
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend responde correctamente"
    curl -s http://localhost:3001/health
else
    print_error "Backend NO responde"
fi

echo ""
echo ""
print_info "Si ves errores de Prisma como 'Unknown argument', significa que los nombres de campos no coinciden con el schema"
print_info "Ejecuta: docker compose build --no-cache backend && docker compose up -d backend"
