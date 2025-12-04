# 📦 Guía de Instalación - Sistema de Gestión Escolar

Esta guía te ayudará a instalar y configurar el Sistema de Gestión Escolar de manera rápida y sencilla.

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Docker** (versión 20.10 o superior)
- **Docker Compose** (versión 2.0 o superior)

### Verificar Instalación

```bash
# Verificar Docker
docker --version

# Verificar Docker Compose
docker-compose --version
```

Si no tienes Docker instalado, visita: https://www.docker.com/get-started

## 🚀 Instalación Rápida (5 minutos)

### Paso 1: Clonar el Repositorio

```bash
git clone <url-del-repositorio>
cd gestion-escolar
```

### Paso 2: Configurar Variables de Entorno (Opcional)

El sistema funciona con valores por defecto, pero puedes personalizarlos:

1. **Crear archivo `.env` en la raíz del proyecto** (opcional):
```bash
# En la raíz del proyecto
cp .env.example .env
# Edita .env si necesitas cambiar puertos o credenciales
```

2. **Crear archivo `.env` en `backend/`** (opcional):
```bash
cd backend
cp .env.example .env
# Edita .env si ejecutas el backend localmente (sin Docker)
```

3. **Crear archivo `.env` en `frontend/`** (opcional):
```bash
cd frontend
cp .env.example .env
# Edita .env si ejecutas el frontend localmente (sin Docker)
```

> **Nota**: Si usas Docker Compose, los valores por defecto funcionarán perfectamente. Solo necesitas crear los archivos `.env` si quieres personalizar la configuración.

### Paso 3: Levantar los Servicios

```bash
# Desde la raíz del proyecto
docker-compose up -d
```

Este comando:
- Descarga las imágenes necesarias (si no las tienes)
- Construye los contenedores del backend y frontend
- Inicia PostgreSQL, Backend y Frontend
- Configura la red interna entre servicios

### Paso 4: Esperar a que los Servicios Estén Listos

Espera aproximadamente 30-60 segundos para que todos los servicios inicien correctamente.

Verifica el estado:
```bash
docker-compose ps
```

Todos los servicios deben mostrar "Up" en la columna de estado.

### Paso 5: Configurar la Base de Datos

```bash
# Generar el cliente de Prisma
docker-compose exec backend npm run prisma:generate

# Ejecutar migraciones (crear tablas)
docker-compose exec backend npm run prisma:migrate

# Poblar la base de datos con datos iniciales
docker-compose exec backend npm run prisma:seed
```

### Paso 6: ¡Listo! Acceder a la Aplicación

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Documentación API (Swagger)**: http://localhost:3000/api-docs

## 👤 Credenciales de Acceso Inicial

Después de ejecutar el seed, puedes iniciar sesión con:

### Administrador
- **Email**: `admin@gestionescolar.edu`
- **Contraseña**: `admin123`

### Otros Usuarios de Prueba
- **Profesor**: `profesor@gestionescolar.edu` / `profesor123`
- **Estudiante**: `estudiante@gestionescolar.edu` / `estudiante123`
- **Representante**: `representante@gestionescolar.edu` / `representante123`

## 🔧 Comandos Útiles

### Ver Logs
```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Detener Servicios
```bash
# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (¡CUIDADO! Esto borra la base de datos)
docker-compose down -v
```

### Reiniciar Servicios
```bash
# Reiniciar todos los servicios
docker-compose restart

# Reiniciar un servicio específico
docker-compose restart backend
```

### Reconstruir Contenedores
```bash
# Reconstruir después de cambios en Dockerfiles
docker-compose up -d --build
```

### Ejecutar Comandos en Contenedores
```bash
# Ejecutar comandos en el backend
docker-compose exec backend npm run <comando>

# Ejecutar comandos en el frontend
docker-compose exec frontend npm run <comando>

# Acceder a la shell del backend
docker-compose exec backend sh

# Acceder a la shell de PostgreSQL
docker-compose exec postgres psql -U gestionscolar -d gestion_escolar
```

## 🐛 Solución de Problemas

### Error: "Port already in use"
Si los puertos 3000, 5173 o 5432 están en uso:

1. **Opción 1**: Detener el servicio que usa el puerto
2. **Opción 2**: Cambiar los puertos en `.env`:
```env
BACKEND_PORT=3001
FRONTEND_PORT=5174
POSTGRES_PORT=5433
```

### Error: "Cannot connect to database"
1. Verifica que PostgreSQL esté corriendo:
```bash
docker-compose ps postgres
```

2. Espera unos segundos más (PostgreSQL puede tardar en iniciar)

3. Verifica los logs:
```bash
docker-compose logs postgres
```

### Error: "Module not found" o errores de dependencias
Reconstruye los contenedores:
```bash
docker-compose down
docker-compose up -d --build
```

### Frontend no muestra nada
1. Abre las herramientas de desarrollador (F12)
2. Verifica errores en la consola
3. Verifica que el backend esté corriendo en http://localhost:3000
4. Limpia la caché del navegador (Ctrl+Shift+R)

### Reinicio Completo
Si nada funciona, reinicia completamente:
```bash
# Detener todo
docker-compose down

# Eliminar volúmenes (¡Borra la base de datos!)
docker-compose down -v

# Reconstruir y levantar
docker-compose up -d --build

# Esperar 30 segundos
# Luego ejecutar migraciones y seed nuevamente
docker-compose exec backend npm run prisma:generate
docker-compose exec backend npm run prisma:migrate
docker-compose exec backend npm run prisma:seed
```

## 📝 Configuración Avanzada

### Variables de Entorno Disponibles

#### Docker Compose (.env en la raíz)
- `POSTGRES_USER`: Usuario de PostgreSQL (default: gestionscolar)
- `POSTGRES_PASSWORD`: Contraseña de PostgreSQL (default: gestionscolar2024)
- `POSTGRES_DB`: Nombre de la base de datos (default: gestion_escolar)
- `POSTGRES_PORT`: Puerto de PostgreSQL (default: 5432)
- `BACKEND_PORT`: Puerto del backend (default: 3000)
- `FRONTEND_PORT`: Puerto del frontend (default: 5173)
- `JWT_SECRET`: Secreto para JWT (cambiar en producción)
- `JWT_EXPIRES_IN`: Tiempo de expiración del token (default: 7d)
- `VITE_API_URL`: URL de la API para el frontend

### Cambiar Puertos

Edita el archivo `.env` en la raíz:
```env
BACKEND_PORT=3001
FRONTEND_PORT=5174
POSTGRES_PORT=5433
```

Luego actualiza `VITE_API_URL` en el `.env` del frontend:
```env
VITE_API_URL=http://localhost:3001/api/v1
```

## 🎯 Próximos Pasos

1. **Inicia sesión** con las credenciales de administrador
2. **Explora la documentación API** en http://localhost:3000/api-docs
3. **Configura tu institución** desde el panel de administración
4. **Crea usuarios, cursos y estudiantes** según tus necesidades

## 📞 Soporte

Si encuentras problemas:
1. Revisa la sección de "Solución de Problemas" arriba
2. Verifica los logs: `docker-compose logs -f`
3. Consulta el archivo `INSTRUCCIONES.md` para problemas específicos del frontend

## ✅ Verificación de Instalación Exitosa

Para verificar que todo está funcionando:

1. ✅ `docker-compose ps` muestra 3 servicios "Up"
2. ✅ http://localhost:3000/health devuelve `{"status":"OK"}`
3. ✅ http://localhost:5173 muestra la página de login
4. ✅ http://localhost:3000/api-docs muestra Swagger UI
5. ✅ Puedes iniciar sesión con las credenciales de admin

¡Felicitaciones! Tu sistema está listo para usar. 🎉

