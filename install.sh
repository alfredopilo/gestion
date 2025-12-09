#!/bin/bash

# Script de instalación automática para Sistema de Gestión Escolar
# Este script automatiza el proceso de instalación

set -e  # Salir si hay algún error

echo "🚀 Instalación del Sistema de Gestión Escolar"
echo "=============================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar Docker
echo "📋 Verificando requisitos..."
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado. Por favor instala Docker primero."
    exit 1
fi
print_success "Docker está instalado"

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose no está instalado. Por favor instala Docker Compose primero."
    exit 1
fi
print_success "Docker Compose está instalado"

# Verificar si los servicios ya están corriendo
if docker-compose ps | grep -q "Up"; then
    print_warning "Los servicios ya están corriendo. ¿Deseas reiniciarlos? (s/n)"
    read -r response
    if [[ "$response" =~ ^[Ss]$ ]]; then
        echo "🔄 Deteniendo servicios existentes..."
        docker-compose down
    else
        echo "⏭️  Saltando inicio de servicios..."
        exit 0
    fi
fi

# Crear archivos .env si no existen
echo ""
echo "📝 Configurando archivos de entorno..."

if [ ! -f .env ]; then
    print_warning "No se encontró .env en la raíz. Usando valores por defecto."
    print_warning "Puedes crear .env manualmente si necesitas personalizar la configuración."
else
    print_success "Archivo .env encontrado en la raíz"
fi

# Levantar servicios
echo ""
echo "🐳 Levantando servicios Docker..."
docker-compose up -d --build

# Esperar a que PostgreSQL esté listo
echo ""
echo "⏳ Esperando a que PostgreSQL esté listo..."
sleep 5

max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose exec -T postgres pg_isready -U gestionscolar &> /dev/null; then
        print_success "PostgreSQL está listo"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Intento $attempt/$max_attempts..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    print_error "PostgreSQL no respondió a tiempo. Verifica los logs: docker-compose logs postgres"
    exit 1
fi

# Configurar base de datos
echo ""
echo "🗄️  Configurando base de datos..."

echo "   Generando cliente de Prisma..."
docker-compose exec -T backend npm run prisma:generate

echo "   Ejecutando migraciones..."
docker-compose exec -T backend npm run prisma:migrate:deploy

echo "   Poblando base de datos con datos iniciales..."
docker-compose exec -T backend npm run prisma:seed

print_success "Base de datos configurada correctamente"

# Verificar que los servicios estén corriendo
echo ""
echo "🔍 Verificando servicios..."
sleep 3

if docker-compose ps | grep -q "Up"; then
    print_success "Todos los servicios están corriendo"
else
    print_warning "Algunos servicios pueden no estar corriendo. Verifica con: docker-compose ps"
fi

# Mostrar información final
echo ""
echo "=============================================="
echo "🎉 ¡Instalación completada!"
echo "=============================================="
echo ""
echo "📍 Accesos:"
echo "   • Frontend:        http://localhost"
echo "   • Backend API:      http://localhost:3000"
echo "   • API Docs:        http://localhost:3000/api-docs"
echo ""
echo "👤 Credenciales de acceso:"
echo "   • Admin:           admin@gestionescolar.edu / admin123"
echo "   • Profesor:        profesor@gestionescolar.edu / profesor123"
echo "   • Estudiante:      estudiante@gestionescolar.edu / estudiante123"
echo "   • Representante:   representante@gestionescolar.edu / representante123"
echo ""
echo "📚 Comandos útiles:"
echo "   • Ver logs:        docker-compose logs -f"
echo "   • Detener:         docker-compose down"
echo "   • Reiniciar:       docker-compose restart"
echo ""
echo "📖 Para más información, consulta INSTALACION.md"
echo ""

