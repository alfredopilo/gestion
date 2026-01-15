# 🔧 Solución: Error de Conexión / CORS después de Actualizar

## 🚨 Problema

Después de aplicar las optimizaciones, aparecen errores:
- "Error al iniciar sesión"
- "Solicitud de origen cruzado bloqueada"
- "Error al verificar modo mantenimiento"
- ERR_NETWORK

## 🔍 Causa Más Común

**El backend no está corriendo** después del rebuild o hubo un error al iniciar.

---

## ✅ Solución Rápida (5 minutos)

### Paso 1: Ejecutar el script de verificación

```bash
chmod +x verificar-backend.sh
./verificar-backend.sh
```

Este script:
- ✅ Verifica si los contenedores están corriendo
- ✅ Muestra los logs del backend
- ✅ Prueba el endpoint de salud
- ✅ Verifica PostgreSQL
- ✅ Te dice exactamente qué está mal

### Paso 2: Soluciones según el diagnóstico

#### Si el backend NO está corriendo:

```bash
# Reiniciar backend
docker compose up -d backend

# Esperar 10 segundos
sleep 10

# Verificar
docker compose ps
curl http://localhost:3001/health
```

#### Si hay errores en los logs:

```bash
# Ver logs completos
docker compose logs backend --tail=100

# Buscar errores específicos
docker compose logs backend | grep -i error
```

#### Si PostgreSQL no responde:

```bash
# Reiniciar PostgreSQL
docker compose restart postgres

# Esperar 5 segundos
sleep 5

# Reiniciar backend
docker compose restart backend
```

---

## 🔧 Soluciones Específicas

### Error: "Cannot find module 'dashboardController'"

**Causa**: El nuevo código no se copió al contenedor.

**Solución**:
```bash
# Rebuild forzado del backend
docker compose build --no-cache backend
docker compose up -d backend

# Verificar logs
docker compose logs backend --tail=30
```

---

### Error: "Port 3001 is already in use"

**Causa**: Otro proceso usa el puerto 3001.

**Solución**:
```bash
# Ver qué proceso usa el puerto
lsof -i :3001  # Linux/Mac
netstat -ano | findstr :3001  # Windows

# Matar el proceso (reemplaza PID con el número real)
kill -9 PID

# O cambiar el puerto en docker-compose.yml
# ports: "3002:3000"  # Usar 3002 en lugar de 3001
```

---

### Error: "Database connection failed"

**Causa**: PostgreSQL no está listo cuando el backend intenta conectar.

**Solución**:
```bash
# Verificar PostgreSQL
docker compose exec postgres pg_isready -U gestionscolar

# Si no responde, reiniciar
docker compose restart postgres
sleep 10
docker compose restart backend
```

---

### Error de CORS (después de verificar que backend funciona)

**Causa**: El frontend está intentando conectarse a una URL incorrecta.

**Solución**:

1. **Verificar el archivo `.env` en la raíz**:

```bash
cat .env
```

Debe contener:
```env
VITE_API_URL=http://TU_IP_VPS:3001/api/v1
```

**NO usar localhost si accedes desde otro dispositivo**.

2. **Si no existe, créalo**:

```bash
# Crear archivo .env
cat > .env << 'EOF'
VITE_API_URL=http://142.93.17.71:3001/api/v1
POSTGRES_USER=gestionscolar
POSTGRES_PASSWORD=gestionscolar2024
POSTGRES_DB=gestion_escolar
POSTGRES_PORT=5434
BACKEND_PORT=3001
FRONTEND_PORT=80
JWT_SECRET=mi_secreto_jwt_super_seguro_2024
JWT_EXPIRES_IN=7d
EOF

# IMPORTANTE: Reemplaza 142.93.17.71 con tu IP real
```

3. **Rebuild del frontend** (necesario después de cambiar .env):

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

4. **Limpiar caché del navegador**: `Ctrl+Shift+R` o abrir en modo incógnito

---

## 🐛 Diagnóstico Manual Paso a Paso

### 1. Verificar que los contenedores estén corriendo

```bash
docker compose ps

# Deberías ver:
# gestion-escolar-backend    Up
# gestion-escolar-frontend   Up  
# gestion-escolar-db         Up
```

### 2. Probar el endpoint de salud del backend

```bash
curl http://localhost:3001/health

# Debería responder:
# {"status":"OK","timestamp":"...","service":"Gestión Escolar API"}
```

Si NO responde:
```bash
# Ver logs
docker compose logs backend --tail=50

# Buscar líneas como:
# "🚀 Servidor corriendo en http://0.0.0.0:3000"
# "✅ Base de datos conectada"
```

### 3. Verificar que las nuevas rutas se registraron

```bash
# Probar el nuevo endpoint (debería dar 401 sin token)
curl -I http://localhost:3001/api/v1/dashboard/stats

# Si devuelve 401 = La ruta existe
# Si devuelve 404 = La ruta NO se registró (hay que rebuild)
```

### 4. Verificar conectividad desde el exterior

```bash
# Desde otra terminal o dispositivo
curl http://TU_IP_VPS:3001/health

# Si no funciona, verifica el firewall:
sudo ufw status
sudo ufw allow 3001/tcp
```

---

## 🚀 Solución Definitiva (Si nada funciona)

### Opción 1: Rebuild completo limpio

```bash
# 1. Detener todo
docker compose down

# 2. Eliminar imágenes antiguas
docker images | grep gestion-escolar | awk '{print $3}' | xargs docker rmi -f

# 3. Rebuild desde cero
docker compose build --no-cache

# 4. Iniciar
docker compose up -d

# 5. Esperar 30 segundos
sleep 30

# 6. Verificar
docker compose ps
curl http://localhost:3001/health
```

### Opción 2: Volver a la versión anterior

```bash
# Ver commits recientes
git log --oneline -5

# Volver al commit anterior (reemplaza HASH)
git checkout HASH_DEL_COMMIT_ANTERIOR

# Rebuild
docker compose down
docker compose up -d --build
```

### Opción 3: Usar el script de actualización mejorado

```bash
# Ejecutar script con mejor manejo de errores
./forzar-actualizacion-mejorado.sh

# Seleccionar opción 2 (rebuild con caché)
# o opción 3 (rebuild sin caché si hay problemas)
```

---

## 📋 Checklist de Verificación

Marca cada ítem después de verificarlo:

- [ ] Los 3 contenedores están "Up": `docker compose ps`
- [ ] Backend responde a `/health`: `curl http://localhost:3001/health`
- [ ] PostgreSQL responde: `docker compose exec postgres pg_isready -U gestionscolar`
- [ ] No hay errores en logs del backend: `docker compose logs backend --tail=50`
- [ ] El archivo `.env` existe y tiene la IP correcta
- [ ] El puerto 3001 está abierto en el firewall (si es VPS)
- [ ] La caché del navegador está limpia (Ctrl+Shift+R)

---

## 💡 Prevención para el Futuro

### 1. Siempre verificar después de actualizar

```bash
# Después de git pull y rebuild:
./verificar-backend.sh
```

### 2. Guardar el archivo .env

El archivo `.env` es crítico y no está en Git (por seguridad).

```bash
# Hacer backup
cp .env .env.backup

# Guardar en lugar seguro (no subir a Git)
```

### 3. Usar los scripts de actualización

```bash
# En lugar de comandos manuales, usa:
./forzar-actualizacion-mejorado.sh  # Más robusto
# o
./actualizar-solo-backend.sh        # Solo backend
```

---

## 🆘 Ayuda Adicional

### Ver todos los logs

```bash
# Backend
docker compose logs backend

# Frontend
docker compose logs frontend

# PostgreSQL
docker compose logs postgres

# Todos
docker compose logs
```

### Conectar a la base de datos directamente

```bash
docker compose exec postgres psql -U gestionscolar -d gestion_escolar

# Dentro de psql:
\dt              # Ver tablas
\d "User"        # Ver estructura de tabla User
SELECT COUNT(*) FROM "User";
\q               # Salir
```

### Reiniciar todo desde cero

```bash
# ⚠️  CUIDADO: Esto borra los datos de la BD
docker compose down -v
docker compose up -d
```

---

## 📞 Comandos Útiles Resumen

```bash
# Verificación rápida
./verificar-backend.sh

# Ver logs
docker compose logs backend --tail=50

# Reiniciar backend
docker compose restart backend

# Rebuild backend
docker compose build --no-cache backend && docker compose up -d backend

# Verificar salud
curl http://localhost:3001/health

# Ver estado
docker compose ps

# Aplicar índices (si no lo hiciste)
./aplicar-indices.sh
```

---

**La solución más común es simplemente reiniciar el backend:**

```bash
docker compose restart backend
sleep 10
curl http://localhost:3001/health
```

Si eso no funciona, ejecuta `./verificar-backend.sh` y sigue las recomendaciones.
