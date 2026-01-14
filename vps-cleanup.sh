#!/bin/bash

# Script de limpieza para VPS
# Libera espacio eliminando imágenes y contenedores viejos de Docker

echo "🧹 Herramienta de Limpieza para VPS"
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

# ============================================
# DIAGNÓSTICO INICIAL
# ============================================
print_info "Espacio en disco ANTES de limpieza:"
echo ""
df -h | grep -E "Filesystem|/$"
echo ""

print_info "Uso de Docker ANTES de limpieza:"
docker system df
echo ""

# ============================================
# OPCIONES DE LIMPIEZA
# ============================================
echo "Selecciona el tipo de limpieza:"
echo ""
echo "  1) SUAVE - Eliminar contenedores e imágenes sin usar (SEGURO)"
echo "     • Elimina contenedores detenidos"
echo "     • Elimina imágenes sin etiqueta"
echo "     • Elimina redes sin usar"
echo "     • NO elimina volúmenes (base de datos segura)"
echo ""
echo "  2) MEDIA - Limpieza suave + caché de build"
echo "     • Todo lo de limpieza suave"
echo "     • Elimina caché de build de Docker"
echo "     • Libera más espacio pero builds serán más lentos"
echo ""
echo "  3) AGRESIVA - Elimina TODO lo no usado (CUIDADO)"
echo "     • Elimina TODAS las imágenes no usadas"
echo "     • Elimina TODOS los volúmenes sin usar"
echo "     • ⚠️  PUEDE BORRAR LA BASE DE DATOS si no está en uso"
echo "     • Solo usar si sabes lo que haces"
echo ""
echo "  4) SOLO ANÁLISIS - Ver qué se limpiaría sin borrar nada"
echo ""
read -p "Opción (1/2/3/4): " -n 1 -r CLEANUP_TYPE
echo
echo ""

case $CLEANUP_TYPE in
    1)
        print_info "Limpieza SUAVE seleccionada"
        print_warning "Esta operación es SEGURA y no afecta datos"
        echo ""
        
        print_info "Espacio que se liberará:"
        docker system df
        echo ""
        
        read -p "¿Continuar? (s/n): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Ss]$ ]] && exit 0
        
        print_info "Eliminando contenedores detenidos..."
        docker container prune -f
        
        print_info "Eliminando imágenes sin usar..."
        docker image prune -f
        
        print_info "Eliminando redes sin usar..."
        docker network prune -f
        
        print_success "Limpieza suave completada"
        ;;
        
    2)
        print_info "Limpieza MEDIA seleccionada"
        print_warning "Los próximos builds serán más lentos (sin caché)"
        echo ""
        
        read -p "¿Continuar? (s/n): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Ss]$ ]] && exit 0
        
        print_info "Ejecutando limpieza suave..."
        docker system prune -f
        
        print_info "Eliminando caché de build..."
        docker builder prune -f
        
        print_success "Limpieza media completada"
        ;;
        
    3)
        print_error "⚠️  LIMPIEZA AGRESIVA - ADVERTENCIA ⚠️"
        echo ""
        print_warning "Esta opción eliminará:"
        print_warning "  • TODAS las imágenes Docker no usadas"
        print_warning "  • TODOS los volúmenes no usados (¡INCLUYENDO BD!)"
        print_warning "  • TODO el caché de build"
        echo ""
        print_error "Asegúrate de que:"
        print_error "  1. Los contenedores importantes estén CORRIENDO"
        print_error "  2. Tengas un BACKUP de la base de datos"
        echo ""
        
        read -p "¿Estás COMPLETAMENTE seguro? Escribe 'SI ESTOY SEGURO': " CONFIRM
        if [ "$CONFIRM" != "SI ESTOY SEGURO" ]; then
            print_info "Operación cancelada"
            exit 0
        fi
        
        print_info "Ejecutando limpieza agresiva..."
        docker system prune -a --volumes -f
        
        print_success "Limpieza agresiva completada"
        print_warning "Recuerda: el próximo build será MUY lento"
        print_warning "Verifica que tu aplicación funcione correctamente"
        ;;
        
    4)
        print_info "ANÁLISIS DEL SISTEMA (sin borrar nada)"
        echo ""
        
        print_info "Espacio en disco:"
        df -h | grep -E "Filesystem|/$"
        echo ""
        
        print_info "Uso de Docker:"
        docker system df -v
        echo ""
        
        print_info "Contenedores detenidos que se pueden eliminar:"
        docker container ls -a --filter "status=exited" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Size}}"
        echo ""
        
        print_info "Imágenes sin usar que se pueden eliminar:"
        docker images --filter "dangling=true" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
        echo ""
        
        print_info "Volúmenes sin usar que se pueden eliminar:"
        docker volume ls --filter "dangling=true"
        echo ""
        
        print_success "Análisis completado"
        exit 0
        ;;
        
    *)
        print_error "Opción inválida"
        exit 1
        ;;
esac

# ============================================
# DIAGNÓSTICO FINAL
# ============================================
echo ""
print_info "Espacio en disco DESPUÉS de limpieza:"
df -h | grep -E "Filesystem|/$"
echo ""

print_info "Uso de Docker DESPUÉS de limpieza:"
docker system df
echo ""

print_success "Limpieza completada exitosamente"
echo ""

print_info "Recomendaciones:"
echo "  • Si liberaste mucho espacio, considera hacer backup"
echo "  • El próximo build puede ser más lento si limpiaste caché"
echo "  • Verifica que tu aplicación funcione: docker compose ps"
echo ""
