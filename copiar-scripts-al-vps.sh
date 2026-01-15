#!/bin/bash

# Script para copiar los nuevos scripts de solución al VPS

echo "============================================"
echo "   COPIAR SCRIPTS DE SOLUCIÓN AL VPS"
echo "============================================"
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

# Verificar que los archivos existen
if [ ! -f "forzar-actualizacion.sh" ]; then
    print_error "No se encuentra forzar-actualizacion.sh"
    exit 1
fi

if [ ! -f "diagnostico-vps.sh" ]; then
    print_error "No se encuentra diagnostico-vps.sh"
    exit 1
fi

print_success "Scripts encontrados:"
echo "  • forzar-actualizacion.sh"
echo "  • diagnostico-vps.sh"
echo "  • SOLUCION-CAMBIOS-NO-SE-REFLEJAN.md"
echo "  • LEEME-PRIMERO-VPS.md"
echo ""

# Pedir datos del VPS
read -p "Ingresa la IP de tu VPS (ej: 142.93.17.71): " VPS_IP
read -p "Ingresa el usuario SSH (ej: root): " VPS_USER
read -p "Ingresa la ruta del proyecto en VPS (ej: /root/GestionEscolar): " VPS_PATH

echo ""
print_info "Configuración:"
echo "  IP:       $VPS_IP"
echo "  Usuario:  $VPS_USER"
echo "  Ruta:     $VPS_PATH"
echo ""

read -p "¿Es correcta esta configuración? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_info "Operación cancelada"
    exit 0
fi

echo ""
echo "============================================"
echo "   COPIANDO ARCHIVOS..."
echo "============================================"
echo ""

# Verificar que scp esté disponible
if ! command -v scp &> /dev/null; then
    print_error "El comando 'scp' no está disponible"
    echo ""
    echo "Instala OpenSSH client:"
    echo "  • Ubuntu/Debian: sudo apt-get install openssh-client"
    echo "  • macOS: Ya viene instalado"
    echo "  • Arch: sudo pacman -S openssh"
    echo ""
    exit 1
fi

# Función para copiar con manejo de errores
copy_file() {
    local file=$1
    local dest="${VPS_USER}@${VPS_IP}:${VPS_PATH}/"
    
    print_info "Copiando $file..."
    if scp "$file" "$dest"; then
        print_success "$file copiado"
    else
        print_error "Error al copiar $file"
        return 1
    fi
}

# Copiar archivos
copy_file "forzar-actualizacion.sh"
copy_file "diagnostico-vps.sh"
copy_file "SOLUCION-CAMBIOS-NO-SE-REFLEJAN.md"
copy_file "LEEME-PRIMERO-VPS.md"

echo ""
echo "============================================"
echo "   DANDO PERMISOS DE EJECUCIÓN"
echo "============================================"
echo ""

print_info "Conectando al VPS para dar permisos..."
if ssh "${VPS_USER}@${VPS_IP}" "cd ${VPS_PATH} && chmod +x forzar-actualizacion.sh diagnostico-vps.sh && ls -lh *.sh | grep -E 'forzar|diagnostico'"; then
    echo ""
    echo "============================================"
    print_success "ARCHIVOS COPIADOS EXITOSAMENTE"
    echo "============================================"
    echo ""
    
    echo "Los siguientes archivos fueron copiados al VPS:"
    echo "  ✅ forzar-actualizacion.sh     (con permisos de ejecución)"
    echo "  ✅ diagnostico-vps.sh          (con permisos de ejecución)"
    echo "  ✅ SOLUCION-CAMBIOS-NO-SE-REFLEJAN.md"
    echo "  ✅ LEEME-PRIMERO-VPS.md"
    echo ""
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_info "SIGUIENTES PASOS:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo "1️⃣  Conéctate a tu VPS:"
    echo "   ${BLUE}ssh ${VPS_USER}@${VPS_IP}${NC}"
    echo ""
    
    echo "2️⃣  Ve al directorio del proyecto:"
    echo "   ${BLUE}cd ${VPS_PATH}${NC}"
    echo ""
    
    echo "3️⃣  Ejecuta el script de solución:"
    echo "   ${BLUE}./forzar-actualizacion.sh${NC}"
    echo ""
    
    echo "4️⃣  O si prefieres ver el diagnóstico primero:"
    echo "   ${BLUE}./diagnostico-vps.sh${NC}"
    echo ""
    
    echo "5️⃣  Lee la guía completa:"
    echo "   ${BLUE}cat LEEME-PRIMERO-VPS.md${NC}"
    echo ""
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_info "CONEXIÓN RÁPIDA (copia y pega):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "${YELLOW}ssh ${VPS_USER}@${VPS_IP} 'cd ${VPS_PATH} && ./forzar-actualizacion.sh'${NC}"
    echo ""
    
else
    echo ""
    print_error "No se pudo copiar o dar permisos a los archivos"
    echo ""
    echo "Verifica:"
    echo "  • Que la IP sea correcta: $VPS_IP"
    echo "  • Que el usuario sea correcto: $VPS_USER"
    echo "  • Que la ruta exista: $VPS_PATH"
    echo "  • Que tengas acceso SSH al VPS"
    echo ""
    print_info "Puedes probar la conexión con:"
    echo "  ssh ${VPS_USER}@${VPS_IP} 'pwd'"
    echo ""
    exit 1
fi
