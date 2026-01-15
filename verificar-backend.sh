#!/bin/bash

# Script para verificar y solucionar problemas con el backend después de actualizar

echo "🔍 VERIFICACIÓN RÁPIDA DEL BACKEND"
echo "===================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Detectar docker compose
if command -v docker-compose &> /dev/null; then
    DC="docker-compose"
else
    DC="docker compose"
fi

# ============================================
# 1. VERIFICAR CONTENEDORES
# ============================================
print_info "1. Verificando estado de contenedores..."
echo ""

$DC ps

echo ""

# Verificar si el backend está corriendo
if $DC ps backend | grep -q "Up"; then
    print_success "Backend está corriendo"
else
    print_error "Backend NO está corriendo"
    echo ""
    print_info "Intentando iniciar backend..."
    $DC up -d backend
    sleep 5
    
    if $DC ps backend | grep -q "Up"; then
        print_success "Backend iniciado correctamente"
    else
        print_error "Error al iniciar backend"
        print_info "Ver logs: $DC logs backend --tail=50"
        exit 1
    fi
fi

echo ""

# ============================================
# 2. VERIFICAR LOGS DEL BACKEND
# ============================================
print_info "2. Últimos logs del backend (20 líneas)..."
echo ""

$DC logs backend --tail=20

echo ""

# Buscar errores en los logs
if $DC logs backend --tail=50 | grep -i "error" | grep -v "errorHandler" | head -5; then
    print_warning "Se encontraron errores en los logs"
else
    print_success "No se encontraron errores críticos en los logs"
fi

echo ""

# ============================================
# 3. VERIFICAR SALUD DEL BACKEND
# ============================================
print_info "3. Verificando endpoint de salud..."
echo ""

# Esperar un poco para que el backend inicie
sleep 3

# Probar endpoint de salud
if curl -sf http://localhost:3001/health > /dev/null; then
    print_success "Backend responde correctamente"
    echo ""
    print_info "Respuesta del endpoint:"
    curl -s http://localhost:3001/health | head -5
else
    print_error "Backend NO responde en http://localhost:3001/health"
    echo ""
    print_info "Posibles causas:"
    echo "  1. El backend está iniciando (espera 30 segundos y vuelve a probar)"
    echo "  2. Hay un error en el código"
    echo "  3. La base de datos no está disponible"
    echo "  4. Puerto 3001 ocupado por otro proceso"
    echo ""
    print_info "Ver logs completos:"
    echo "  $DC logs backend"
fi

echo ""

# ============================================
# 4. VERIFICAR POSTGRESQL
# ============================================
print_info "4. Verificando PostgreSQL..."
echo ""

if $DC exec -T postgres pg_isready -U gestionscolar &> /dev/null; then
    print_success "PostgreSQL está disponible"
else
    print_error "PostgreSQL NO está disponible"
    print_info "Reiniciando PostgreSQL..."
    $DC restart postgres
    sleep 5
fi

echo ""

# ============================================
# 5. VERIFICAR RUTAS REGISTRADAS
# ============================================
print_info "5. Verificando nuevas rutas del dashboard..."
echo ""

# Intentar acceder al nuevo endpoint (sin autenticación, solo para ver si existe)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/dashboard/stats)

if [ "$HTTP_CODE" = "401" ]; then
    print_success "Endpoint /api/v1/dashboard/stats existe (401 = necesita autenticación)"
elif [ "$HTTP_CODE" = "200" ]; then
    print_success "Endpoint /api/v1/dashboard/stats responde correctamente"
elif [ "$HTTP_CODE" = "404" ]; then
    print_error "Endpoint /api/v1/dashboard/stats NO ENCONTRADO"
    print_warning "Las rutas del dashboard no se registraron correctamente"
    echo ""
    print_info "SOLUCIÓN: Reiniciar el backend"
    $DC restart backend
    sleep 10
else
    print_warning "Endpoint responde con código: $HTTP_CODE"
fi

echo ""

# ============================================
# 6. VERIFICAR ARCHIVO .env
# ============================================
print_info "6. Verificando configuración .env..."
echo ""

if [ -f ".env" ]; then
    print_success "Archivo .env existe"
    
    # Verificar VITE_API_URL
    if grep -q "VITE_API_URL" .env; then
        API_URL=$(grep "VITE_API_URL" .env | cut -d'=' -f2)
        print_info "VITE_API_URL: $API_URL"
        
        if echo "$API_URL" | grep -q "localhost"; then
            print_warning "Usando localhost - No funcionará desde otros dispositivos"
            print_info "Para producción, usa: VITE_API_URL=http://TU_IP_VPS:3001/api/v1"
        fi
    else
        print_warning "VITE_API_URL no está definida"
        print_info "Agrega en .env: VITE_API_URL=http://142.93.17.71:3001/api/v1"
    fi
else
    print_warning "Archivo .env no existe en la raíz"
    print_info "Crea un archivo .env con:"
    echo "VITE_API_URL=http://TU_IP_VPS:3001/api/v1"
fi

echo ""

# ============================================
# 7. PROBAR CONEXIÓN DESDE FRONTEND
# ============================================
print_info "7. Verificando accesibilidad desde el exterior..."
echo ""

# Obtener IP pública si es posible
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "No se pudo obtener")

if [ "$PUBLIC_IP" != "No se pudo obtener" ]; then
    print_info "Tu IP pública es: $PUBLIC_IP"
    print_info "El frontend debería usar: http://$PUBLIC_IP:3001/api/v1"
else
    print_info "No se pudo determinar la IP pública"
fi

echo ""

# Verificar si el puerto 3001 está escuchando en todas las interfaces
if netstat -tuln 2>/dev/null | grep -q ":3001.*0.0.0.0" || ss -tuln 2>/dev/null | grep -q ":3001.*0.0.0.0"; then
    print_success "Backend escuchando en todas las interfaces (0.0.0.0:3001)"
elif netstat -tuln 2>/dev/null | grep -q ":3001" || ss -tuln 2>/dev/null | grep -q ":3001"; then
    print_warning "Backend escuchando solo en localhost"
    print_info "Verifica que docker-compose.yml tenga: ports: '3001:3000'"
else
    print_error "Puerto 3001 no está escuchando"
fi

echo ""

# ============================================
# RESUMEN Y RECOMENDACIONES
# ============================================
echo "=============================================="
print_info "RESUMEN"
echo "=============================================="
echo ""

# Verificar estado general
ALL_OK=true

# Verificar backend
if ! $DC ps backend | grep -q "Up"; then
    print_error "Backend no está corriendo"
    ALL_OK=false
fi

# Verificar salud
if ! curl -sf http://localhost:3001/health > /dev/null; then
    print_error "Backend no responde a /health"
    ALL_OK=false
fi

# Verificar PostgreSQL
if ! $DC exec -T postgres pg_isready -U gestionscolar &> /dev/null; then
    print_error "PostgreSQL no está disponible"
    ALL_OK=false
fi

echo ""

if [ "$ALL_OK" = true ]; then
    print_success "Todo parece estar funcionando correctamente"
    echo ""
    print_info "URLs de acceso:"
    echo "  • Frontend: http://localhost"
    echo "  • Backend:  http://localhost:3001"
    echo "  • Health:   http://localhost:3001/health"
    echo ""
    print_info "Si el frontend sigue sin funcionar:"
    echo "  1. Limpia la caché del navegador (Ctrl+Shift+R)"
    echo "  2. Verifica el archivo .env del frontend"
    echo "  3. Reinicia el frontend: $DC restart frontend"
else
    print_warning "Se encontraron problemas"
    echo ""
    print_info "SOLUCIONES RECOMENDADAS:"
    echo ""
    echo "1. Reiniciar todos los servicios:"
    echo "   $DC restart"
    echo ""
    echo "2. Ver logs completos del backend:"
    echo "   $DC logs backend --tail=100"
    echo ""
    echo "3. Ver logs del frontend:"
    echo "   $DC logs frontend --tail=50"
    echo ""
    echo "4. Si el problema persiste, rebuild completo:"
    echo "   $DC down"
    echo "   $DC up -d --build"
    echo ""
    echo "5. Verificar que el código se actualizó:"
    echo "   git log --oneline -5"
    echo ""
fi

echo ""
print_info "Para más ayuda, ejecuta: ./diagnostico-vps.sh"
