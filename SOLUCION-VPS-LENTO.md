# 🚨 SOLUCIÓN: Build Docker Muy Lento en VPS

## ❌ Problema

Has ejecutado:
```bash
docker compose build --no-cache
```

Y el proceso lleva **más de 10-20 minutos** o se quedó "pegado" en algún paso.

## ✅ Solución Rápida

### 1️⃣ Si el proceso está corriendo actualmente:

**NO lo interrumpas todavía**. Puede que solo esté lento pero funcionando. Verifica:

```bash
# En otra terminal/sesión SSH, verifica que esté trabajando
docker ps
docker stats

# Ver logs del build (si usaste compose)
docker compose logs -f
```

Si ves actividad (CPU/red activos), **déjalo terminar**.

Si no hay actividad por más de 5 minutos:
```bash
Ctrl+C  # Cancelar el build
```

### 2️⃣ Usa el script optimizado

En lugar de `docker compose build --no-cache`, usa:

```bash
chmod +x vps-update.sh
./vps-update.sh
```

Selecciona la **opción 2** (Media - con caché).

**Tiempo esperado:** 2-3 minutos en lugar de 10-20 minutos.

---

## 🔍 ¿Por qué estaba tan lento?

### El problema con `--no-cache`:

```bash
docker compose build --no-cache
```

Este comando:
1. ❌ Elimina TODA la caché de Docker
2. ❌ Re-descarga la imagen base de Node (200+ MB)
3. ❌ Re-instala TODAS las dependencias de npm (500+ paquetes)
4. ❌ Re-compila TODA la aplicación

**Resultado:** 10-20 minutos en VPS con recursos limitados.

### La solución con caché:

```bash
docker compose build  # SIN --no-cache
```

Este comando:
1. ✅ Usa caché de capas anteriores
2. ✅ Solo re-descarga lo que cambió
3. ✅ Solo re-instala dependencias nuevas
4. ✅ Solo re-compila código modificado

**Resultado:** 2-3 minutos.

---

## 📊 Comparación Visual

### Build SIN caché (--no-cache) ❌

```
Step 1/10: FROM node:20-alpine
 → Descargando imagen base...                    [30 segundos]

Step 2/10: RUN apk add openssl postgresql-client
 → Instalando dependencias sistema...            [20 segundos]

Step 3/10: COPY package*.json ./
 → Copiando archivos...                          [2 segundos]

Step 4/10: RUN npm ci
 → Instalando 500+ paquetes npm...               [180 segundos]
 → Compilando dependencias nativas...            [60 segundos]

Step 5/10: COPY prisma ./prisma/
 → Copiando archivos...                          [2 segundos]

Step 6/10: RUN npx prisma generate
 → Generando cliente Prisma...                   [30 segundos]

Step 7/10: COPY . .
 → Copiando código fuente...                     [10 segundos]

Step 8/10: RUN npm run build (frontend)
 → Compilando React/Vite...                      [90 segundos]

TOTAL: ~7-10 minutos (o más en VPS lento)
```

### Build CON caché ✅

```
Step 1/10: FROM node:20-alpine
 → CACHED                                         [0.1 segundos]

Step 2/10: RUN apk add openssl postgresql-client
 → CACHED                                         [0.1 segundos]

Step 3/10: COPY package*.json ./
 → CACHED (package.json no cambió)                [0.1 segundos]

Step 4/10: RUN npm ci
 → CACHED (dependencias no cambiaron)             [0.1 segundos]

Step 5/10: COPY prisma ./prisma/
 → CACHED (schema no cambió)                      [0.1 segundos]

Step 6/10: RUN npx prisma generate
 → CACHED                                         [0.1 segundos]

Step 7/10: COPY . .
 → RUN (código cambió, se recopia)                [10 segundos]

Step 8/10: RUN npm run build
 → RUN (se recompila con código nuevo)            [90 segundos]

TOTAL: ~2 minutos
```

---

## 🎯 Estrategia de Actualización

### Cuándo usar cada tipo:

| Situación | Comando | Tiempo |
|-----------|---------|--------|
| **Cambios en código JS/JSX** | `./vps-update.sh` → Opción 1 (Rápida) | 30s |
| **Cambios en package.json** | `./vps-update.sh` → Opción 2 (Media) | 2-3min |
| **Cambios en Dockerfile** | `./vps-update.sh` → Opción 2 (Media) | 2-3min |
| **Primera instalación** | `./install.sh` | 3-5min |
| **Problemas graves/corrupción** | `./vps-update.sh` → Opción 3 (Completa) | 5-10min |

---

## 🛠️ Pasos Específicos para Tu Caso

### Si el build está actualmente pegado:

```bash
# 1. Cancelar el proceso actual
Ctrl+C

# 2. Verificar estado de contenedores
docker compose ps

# 3. Si hay contenedores corriendo, detenerlos
docker compose down

# 4. Verificar espacio en disco
df -h
# Si está >80% lleno, limpia primero:
./vps-cleanup.sh  # Opción 1 (Suave)

# 5. Ejecutar actualización optimizada
./vps-update.sh
# Selecciona opción 2 (Media)
```

### Si el build ya terminó pero los cambios no se ven:

```bash
# 1. Reiniciar servicios
docker compose down
docker compose up -d

# 2. Verificar logs
docker compose logs -f backend

# 3. Limpiar caché del navegador
# Chrome: Ctrl+Shift+R
# Firefox: Ctrl+F5
```

---

## 📞 Ayuda Adicional

Si sigues teniendo problemas:

1. **Ejecuta diagnóstico:**
   ```bash
   ./vps-update.sh  # Opción 5 (Diagnóstico)
   ```

2. **Verifica recursos del VPS:**
   ```bash
   # Memoria disponible
   free -h
   
   # Espacio en disco
   df -h
   
   # Procesos activos
   top  # Presiona 'q' para salir
   ```

3. **Revisa logs detallados:**
   ```bash
   # Logs del último build
   cat /tmp/build-backend.log
   cat /tmp/build-frontend.log
   ```

4. **Consulta la guía completa:**
   - [VPS-GUIA-RAPIDA.md](./VPS-GUIA-RAPIDA.md)

---

## 💡 Recomendaciones Finales

### Para evitar este problema en el futuro:

1. ✅ **USA `vps-update.sh`** en lugar de `docker compose build`
2. ✅ **Evita `--no-cache`** a menos que sea absolutamente necesario
3. ✅ **Monitorea espacio en disco** regularmente con `df -h`
4. ✅ **Limpia Docker** periódicamente con `./vps-cleanup.sh`
5. ✅ **Mantén backups** de la base de datos antes de actualizaciones grandes

### Flujo de trabajo recomendado:

```bash
# En tu máquina local
git add .
git commit -m "feat: nueva funcionalidad"
git push

# En el VPS
./deploy-vps.sh  # Hace pull + actualización automática inteligente
```

---

**Última actualización:** Enero 2026
