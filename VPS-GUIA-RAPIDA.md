# 🚀 Guía Rápida para VPS - Sistema de Gestión Escolar

## ⚡ Problema Común: Build Muy Lento

### ¿Por qué tarda tanto?

Cuando ejecutas `docker compose build --no-cache` en un VPS, el proceso puede tardar 10-20 minutos o más porque:

1. **--no-cache** elimina toda la caché de Docker y reinstala TODO desde cero
2. npm debe descargar TODAS las dependencias nuevamente (puede ser varios GB)
3. VPS generalmente tiene CPU/RAM limitados (1-2 cores, 1-2GB RAM)
4. Conexión del VPS puede ser más lenta que tu internet local

### ✅ Solución: Usar vps-update.sh

He creado el script `vps-update.sh` que optimiza las actualizaciones para VPS:

```bash
# En tu VPS
chmod +x vps-update.sh
./vps-update.sh
```

## 📋 Tipos de Actualización

### 1️⃣ RÁPIDA (30 segundos) ⚡
**Cuándo usar:** Solo cambiaste archivos JS/JSX en `src/`

```bash
./vps-update.sh
# Selecciona opción 1
```

**Qué hace:**
- Copia los archivos nuevos a los contenedores en ejecución
- Reinicia el backend
- NO reconstruye imágenes Docker

**Ventajas:**
- Muy rápido (30 segundos)
- No consume recursos

**Limitaciones:**
- Solo funciona para cambios de código
- No actualiza dependencias npm
- No actualiza Dockerfile

---

### 2️⃣ MEDIA (2-3 minutos) 🔄
**Cuándo usar:** 
- Cambiaste `package.json` (agregaste/actualizaste dependencias)
- Cambiaste `Dockerfile`
- Primera vez después de clonar el repositorio

```bash
./vps-update.sh
# Selecciona opción 2
```

**Qué hace:**
- Reconstruye imágenes Docker CON caché
- Actualiza dependencias npm
- Reinicia servicios

**Ventajas:**
- Rápido (2-3 min) gracias a la caché de Docker
- Actualiza todo correctamente

**Esto es lo que DEBES usar en la mayoría de casos**

---

### 3️⃣ COMPLETA (5-10 minutos) 🔨
**Cuándo usar:** 
- Hay problemas graves (contenedores no funcionan)
- La caché está corrupta
- Después de actualizar versiones de Node

```bash
./vps-update.sh
# Selecciona opción 3
```

**Qué hace:**
- Reconstruye imágenes Docker SIN caché (--no-cache)
- Descarga e instala todo desde cero
- Limpia problemas de caché

**Advertencia:**
- MUY LENTO (5-10 minutos en VPS)
- Solo usar cuando las otras opciones no funcionan

---

### 4️⃣ SOLO BACKEND (1-2 minutos) 🎯
**Cuándo usar:** 
- Solo cambiaste código del backend
- Frontend está funcionando bien

```bash
./vps-update.sh
# Selecciona opción 4
```

---

### 5️⃣ DIAGNÓSTICO (10 segundos) 🔍
**Cuándo usar:** 
- Quieres ver el estado del sistema
- Hay un error y no sabes qué pasa

```bash
./vps-update.sh
# Selecciona opción 5
```

**Muestra:**
- Estado de contenedores
- Logs recientes
- Uso de espacio en disco
- Estado de migraciones

---

## 🆘 Solución de Problemas Comunes

### Problema: "Build se quedó pegado"

```bash
# Opción 1: Cancelar y ver logs
Ctrl+C
docker compose logs backend --tail=50

# Opción 2: Limpiar y reintentar
docker compose down
docker system prune -f
./vps-update.sh  # Opción 2
```

### Problema: "Sin espacio en disco"

```bash
# Ver uso de espacio
df -h
docker system df

# Limpiar imágenes viejas (¡CUIDADO!)
docker system prune -a --volumes
# Esto borra TODAS las imágenes no usadas y volúmenes

# Alternativa más segura (solo imágenes sin usar)
docker image prune -a
```

### Problema: "Backend no responde después de actualizar"

```bash
# Ver logs
docker compose logs backend --tail=100

# Problemas comunes:
# 1. Error de migraciones de Prisma
docker compose exec backend npx prisma migrate status
docker compose exec backend npx prisma migrate deploy

# 2. Error de conexión a PostgreSQL
docker compose exec postgres pg_isready -U gestionscolar

# 3. Reiniciar todo
docker compose restart
```

### Problema: "Proceso está muy lento"

```bash
# Ver recursos del sistema
free -h           # Memoria
df -h             # Disco
top               # CPU (presiona q para salir)

# Ver cuánta RAM usa Docker
docker stats --no-stream

# Si tienes poca RAM (<512MB libres), Docker será lento
# Considera:
# - Cerrar otros procesos
# - Upgrade del VPS
# - Limpiar Docker: docker system prune -f
```

---

## 📊 Comparación de Tiempos (VPS típico 2GB RAM)

| Tipo | Tiempo | Cuándo usar |
|------|--------|-------------|
| Rápida | 30s | Cambios de código JS |
| Media | 2-3min | Cambios en dependencias |
| Solo Backend | 1-2min | Solo backend cambió |
| Completa | 5-10min | Problemas graves |
| Con --no-cache manual | 10-20min | ❌ EVITAR |

---

## 🎯 Flujo de Trabajo Recomendado

### Desarrollo normal:
1. Editas código localmente
2. Haces git push
3. En VPS: `git pull && ./vps-update.sh` (opción 2)
4. Verificas que funcione

### Cambios pequeños de código:
1. Editas solo archivos en src/
2. git push
3. En VPS: `git pull && ./vps-update.sh` (opción 1)

### Primera instalación:
1. Clonas repo
2. Copias `.env`
3. Ejecutas `./install.sh`

### Después de pull con cambios en package.json:
1. `git pull`
2. `./vps-update.sh` (opción 2)

---

## 🔧 Comandos Útiles VPS

```bash
# Ver estado de servicios
docker compose ps

# Ver logs en tiempo real
docker compose logs -f

# Ver solo logs del backend
docker compose logs -f backend

# Reiniciar un servicio específico
docker compose restart backend

# Entrar al contenedor backend
docker compose exec backend sh

# Ver variables de entorno
docker compose exec backend env | grep DATABASE

# Ejecutar comandos de Prisma
docker compose exec backend npx prisma migrate status
docker compose exec backend npx prisma studio  # Abrir Prisma Studio

# Backup de base de datos
docker compose exec postgres pg_dump -U gestionscolar gestion_escolar > backup.sql

# Restaurar backup
cat backup.sql | docker compose exec -T postgres psql -U gestionscolar gestion_escolar

# Ver uso de recursos
docker stats

# Limpiar sistema (libera espacio)
docker system prune -f
```

---

## ⚙️ Optimizaciones Adicionales

### 1. Usar BuildKit (más rápido)
Ya configurado en `vps-update.sh`, pero si usas docker compose manualmente:

```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
docker compose build
```

### 2. Configurar límites de memoria
Si tu VPS tiene poca RAM, edita `docker-compose.yml`:

```yaml
services:
  backend:
    # ... resto de config
    mem_limit: 512m
    memswap_limit: 1g
```

### 3. Monitorear recursos
Instala htop para ver recursos en tiempo real:

```bash
sudo apt install htop
htop
```

---

## 📱 Transferir Archivos al VPS

### Desde Windows (cmd o PowerShell):

```bash
# Copiar script
scp vps-update.sh usuario@ip-del-vps:/ruta/al/proyecto/

# Copiar múltiples archivos
scp vps-update.sh VPS-GUIA-RAPIDA.md usuario@ip-del-vps:/ruta/al/proyecto/
```

### Desde Linux/Mac:

```bash
# Copiar script
scp vps-update.sh usuario@ip-del-vps:/ruta/al/proyecto/

# Dar permisos de ejecución remotamente
ssh usuario@ip-del-vps "chmod +x /ruta/al/proyecto/vps-update.sh"
```

### Alternativa: Git
```bash
# En tu máquina local
git add vps-update.sh VPS-GUIA-RAPIDA.md
git commit -m "Agregar scripts optimizados para VPS"
git push

# En el VPS
git pull
chmod +x vps-update.sh
```

---

## 💾 Recomendaciones de Recursos VPS

### Mínimo:
- **RAM:** 2GB
- **CPU:** 1 core
- **Disco:** 20GB SSD
- **Resultado:** Funciona pero builds lentos (5-8 min)

### Recomendado:
- **RAM:** 4GB
- **CPU:** 2 cores
- **Disco:** 40GB SSD
- **Resultado:** Builds rápidos (2-3 min)

### Óptimo:
- **RAM:** 8GB
- **CPU:** 4 cores
- **Disco:** 80GB SSD
- **Resultado:** Builds muy rápidos (1-2 min)

---

## 🎓 Entendiendo la Caché de Docker

### ¿Qué es la caché?

Docker guarda las capas de construcción anteriores. Si no cambias `package.json`:

**Con caché (RÁPIDO):**
```
Step 1: FROM node:20-alpine          ✅ CACHED (0.1s)
Step 2: COPY package*.json ./        ✅ CACHED (0.1s)
Step 3: RUN npm ci                   ✅ CACHED (0.1s)
Step 4: COPY . .                     ⚙️  RUN (2s)
Total: 2.4s
```

**Sin caché (LENTO):**
```
Step 1: FROM node:20-alpine          ⚙️  RUN (10s)
Step 2: COPY package*.json ./        ⚙️  RUN (0.5s)
Step 3: RUN npm ci                   ⚙️  RUN (120s)
Step 4: COPY . .                     ⚙️  RUN (2s)
Total: 132.5s
```

### Cuándo se invalida la caché:

- ❌ Usas `--no-cache`
- ❌ Cambias un Dockerfile
- ❌ Cambias `package.json` o `package-lock.json`
- ❌ Cambias archivos copiados antes de npm install

---

## 📞 Contacto y Soporte

Si tienes problemas:

1. Ejecuta diagnóstico: `./vps-update.sh` (opción 5)
2. Revisa esta guía
3. Revisa logs: `docker compose logs -f`
4. Busca el error en Google/StackOverflow
5. Contacta al equipo de desarrollo

---

**Última actualización:** Enero 2026
