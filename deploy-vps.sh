#!/bin/bash

# Script de deploy automatizado para VPS
# Combina git pull + actualización optimizada

echo "🚀 Deploy Automatizado a VPS"
echo "============================="
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

# Verificar que estamos en un repositorio git
if [ ! -d ".git" ]; then
    print_error "No estás en un repositorio Git"
    exit 1
fi

# ============================================
# PASO 1: Git Pull
# ============================================
print_info "PASO 1: Actualizando código desde Git..."
echo ""

# Guardar hash del commit actual
OLD_COMMIT=$(git rev-parse HEAD)
print_info "Commit actual: ${OLD_COMMIT:0:7}"

# Pull
print_info "Haciendo git pull..."
if git pull; then
    NEW_COMMIT=$(git rev-parse HEAD)
    
    if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
        print_success "Ya estás actualizado (no hay cambios nuevos)"
        
        read -p "¿Quieres actualizar de todos modos? (s/n): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Ss]$ ]] && exit 0
    else
        print_success "Código actualizado a: ${NEW_COMMIT:0:7}"
        
        # Mostrar cambios
        print_info "Cambios en este pull:"
        git log --oneline --decorate --color $OLD_COMMIT..$NEW_COMMIT
        echo ""
        
        # Analizar qué cambió
        FILES_CHANGED=$(git diff --name-only $OLD_COMMIT $NEW_COMMIT)
        
        print_info "Archivos modificados:"
        echo "$FILES_CHANGED" | head -20
        [ $(echo "$FILES_CHANGED" | wc -l) -gt 20 ] && echo "  ... y más"
        echo ""
        
        # Detectar tipo de cambios
        BACKEND_CHANGED=false
        FRONTEND_CHANGED=false
        DEPS_CHANGED=false
        DOCKER_CHANGED=false
        
        if echo "$FILES_CHANGED" | grep -q "^backend/src/"; then
            BACKEND_CHANGED=true
        fi
        
        if echo "$FILES_CHANGED" | grep -q "^frontend/src/"; then
            FRONTEND_CHANGED=true
        fi
        
        if echo "$FILES_CHANGED" | grep -q "package.json\|package-lock.json"; then
            DEPS_CHANGED=true
        fi
        
        if echo "$FILES_CHANGED" | grep -q "Dockerfile\|docker-compose"; then
            DOCKER_CHANGED=true
        fi
        
        PRISMA_CHANGED=false
        if echo "$FILES_CHANGED" | grep -qE "^backend/prisma/|schema\.prisma"; then
            PRISMA_CHANGED=true
        fi
        
        # Recomendar tipo de actualización
        print_info "Análisis de cambios:"
        echo ""
        
        if [ "$DOCKER_CHANGED" = true ] || [ "$DEPS_CHANGED" = true ]; then
            print_warning "Se detectaron cambios en:"
            [ "$DOCKER_CHANGED" = true ] && echo "  • Dockerfile o docker-compose.yml"
            [ "$DEPS_CHANGED" = true ] && echo "  • Dependencias (package.json)"
            echo ""
            print_info "✅ Recomendación: ACTUALIZACIÓN MEDIA (opción 2)"
            RECOMMENDED_OPTION=2
        elif [ "$PRISMA_CHANGED" = true ]; then
            print_warning "Se detectaron cambios en Prisma (schema o migraciones)"
            echo "  • Se requiere rebuild para aplicar migraciones"
            echo ""
            print_info "✅ Recomendación: ACTUALIZACIÓN MEDIA o SOLO BACKEND (opción 2 o 4)"
            RECOMMENDED_OPTION=4
        elif [ "$BACKEND_CHANGED" = true ] && [ "$FRONTEND_CHANGED" = false ]; then
            print_success "Solo cambios en backend/src/"
            print_info "✅ Recomendación: ACTUALIZACIÓN RÁPIDA o SOLO BACKEND (opción 1 o 4)"
            RECOMMENDED_OPTION=4
        elif [ "$FRONTEND_CHANGED" = true ] || [ "$BACKEND_CHANGED" = true ]; then
            print_success "Cambios en código fuente"
            print_info "✅ Recomendación: ACTUALIZACIÓN RÁPIDA (opción 1)"
            RECOMMENDED_OPTION=1
        else
            print_info "Cambios en archivos de configuración o documentación"
            print_info "✅ Recomendación: ACTUALIZACIÓN RÁPIDA (opción 1)"
            RECOMMENDED_OPTION=1
        fi
    fi
else
    print_error "Error al hacer git pull"
    print_warning "Verifica conflictos con: git status"
    exit 1
fi

# ============================================
# PASO 2: Ejecutar actualización
# ============================================
echo ""
print_info "PASO 2: Ejecutar actualización de Docker..."
echo ""

# Verificar que vps-update.sh existe
if [ ! -f "vps-update.sh" ]; then
    print_error "No se encuentra vps-update.sh"
    print_info "Descárgalo desde el repositorio o usa el script de actualización manual"
    exit 1
fi

# Asegurarse de que tiene permisos de ejecución
chmod +x vps-update.sh

# Preguntar si usar recomendación o elegir
print_info "Opciones:"
echo "  1) Usar recomendación automática (opción $RECOMMENDED_OPTION)"
echo "  2) Elegir manualmente"
echo ""
read -p "Selecciona (1/2): " -n 1 -r CHOICE
echo
echo ""

if [ "$CHOICE" = "1" ]; then
    print_info "Ejecutando actualización recomendada (opción $RECOMMENDED_OPTION)..."
    echo ""
    
    # Ejecutar vps-update.sh con la opción recomendada
    # Usar echo para simular input del usuario
    echo "$RECOMMENDED_OPTION" | ./vps-update.sh
else
    print_info "Ejecutando vps-update.sh en modo interactivo..."
    echo ""
    ./vps-update.sh
fi

# ============================================
# RESUMEN FINAL
# ============================================
echo ""
echo "=============================================="
print_success "¡Deploy completado!"
echo "=============================================="
echo ""
echo "📍 Commit desplegado: ${NEW_COMMIT:0:7}"
echo "📍 Servicios: http://localhost"
echo ""
echo "📚 Comandos útiles:"
echo "   • Ver logs:     docker compose logs -f"
echo "   • Ver estado:   docker compose ps"
echo ""
