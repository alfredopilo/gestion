# 🔧 Solución: Build se Queda Colgado en el VPS

## 🚨 Problema

El build del frontend (o backend) se queda "congelado" por 20+ minutos sin mostrar progreso.

## 🔍 Diagnóstico Rápido

### Verificar si el build está activo o colgado:

```bash
# Opción 1: Script automático
chmod +x verificar-build.sh
./verificar-build.sh

# Opción 2: Verificación manual
# Verificar si hay procesos activos
ps aux | grep docker | grep build

# Verificar si el log sigue creciendo (en otra terminal)
watch -n 5 'tail -5 /tmp/build-frontend-forzado.log'

# O simplemente ver el log en tiempo real
tail -f /tmp/build-frontend-forzado.log
```

### Signos de que está ACTIVO (espera):
- ✅ El log sigue creciendo
- ✅ Hay procesos de Docker corriendo (`ps aux | grep docker`)
- ✅ El uso de CPU o memoria cambia
- ✅ Ves mensajes nuevos cada 30-60 segundos

### Signos de que está COLGADO (hay problema):
- ❌ El log NO crece por más de 10 minutos
- ❌ No hay procesos de Docker activos
- ❌ El último mensaje es un error
- ❌ El sistema está inactivo (CPU y memoria constantes)

---

## ✅ Soluciones

### Solución 1: Usar el Script Mejorado (Recomendado)

El script `forzar-actualizacion-mejorado.sh` tiene mejor manejo de timeouts y muestra progreso:

```bash
chmod +x forzar-actualizacion-mejorado.sh
./forzar-actualizacion-mejorado.sh
```

**Ventajas**:
- ✅ Timeout más largo (30 minutos para frontend)
- ✅ Muestra progreso cada 60 segundos
- ✅ Detecta si está colgado automáticamente
- ✅ Te permite extender el timeout si es necesario

---

### Solución 2: Verificar y Continuar Manualmente

Si el build anterior se quedó colgado:

```bash
# 1. Verificar si hay procesos colgados
ps aux | grep docker | grep build

# 2. Matar procesos colgados (si existen)
pkill -f "docker.*build.*frontend"
pkill -f "docker.*build.*backend"

# 3. Ver los logs para entender qué pasó
tail -100 /tmp/build-frontend-forzado.log | grep -i error

# 4. Limpiar y reintentar
docker compose down
docker system prune -f  # Opcional: limpiar caché

# 5. Reintentar el build con más tiempo
timeout 1800 docker compose build --no-cache frontend
# (1800 segundos = 30 minutos)
```

---

### Solución 3: Actualizar Solo Backend (Temporal)

Si el frontend tarda demasiado pero solo necesitas actualizar el backend:

```bash
chmod +x actualizar-solo-backend.sh
./actualizar-solo-backend.sh
```

Esto actualiza solo el backend y deja el frontend como está. Útil cuando:
- Solo cambiaste código del backend
- El frontend funciona bien y no necesitas actualizarlo
- Quieres aplicar cambios rápidamente sin esperar el build del frontend

---

### Solución 4: Build con Más Memoria y Sin Límites

Si tu VPS tiene poca memoria, el build puede fallar o colgarse:

```bash
# 1. Verificar memoria disponible
free -h

# 2. Si tienes menos de 500MB libres, liberar memoria
docker system prune -a --volumes

# 3. Limitar memoria de Docker durante el build
# (Esto puede hacer el build más lento pero más estable)
docker compose build --no-cache --progress=plain frontend 2>&1 | tee /tmp/build.log
```

---

### Solución 5: Build en Background (Para VPS Lentos)

Si tienes un VPS muy lento, ejecuta el build en background:

```bash
# 1. Ejecutar build en background con nohup
nohup docker compose build --no-cache frontend > /tmp/build-frontend.log 2>&1 &
BUILD_PID=$!

# 2. Guardar el PID para verificar después
echo $BUILD_PID > /tmp/build-pid.txt

# 3. Monitorear el progreso
tail -f /tmp/build-frontend.log

# 4. Verificar si terminó (en otra terminal)
ps aux | grep $BUILD_PID

# 5. Cuando termine, levantar servicios
docker compose up -d
```

---

## 🐛 Causas Comunes del Problema

### 1. **VPS con Poca Memoria (< 2GB RAM)**

**Solución**:
- Libera memoria: `docker system prune -a`
- Cierra otros servicios que no uses
- Considera actualizar el plan de tu VPS

### 2. **Conexión a Internet Lenta**

El build descarga muchas dependencias de npm.

**Solución**:
- Espera más tiempo (hasta 30 minutos es normal)
- Verifica la conexión: `ping 8.8.8.8`
- Usa `npm ci --prefer-offline` si tienes cache local

### 3. **Disco Lleno**

**Solución**:
```bash
# Verificar espacio
df -h

# Limpiar Docker
docker system prune -a --volumes

# Limpiar archivos temporales
rm -rf /tmp/build-*.log  # Solo si no los necesitas
```

### 4. **Proceso Docker Zombie**

**Solución**:
```bash
# Matar todos los procesos de build
pkill -9 -f "docker.*build"

# Reiniciar Docker (si es necesario)
sudo systemctl restart docker  # Linux
# O reinicia Docker Desktop en Windows
```

---

## 📊 Tiempos Normales de Build

**En VPS con recursos estándar (2GB RAM, 2 CPU cores):**
- Backend: 2-5 minutos
- Frontend: 5-15 minutos ⚠️ **Es normal que tarde hasta 15-20 minutos**

**En VPS con recursos limitados (1GB RAM, 1 CPU core):**
- Backend: 5-8 minutos
- Frontend: 15-30 minutos ⚠️ **Es normal que tarde hasta 30 minutos**

**Si tarda MÁS de 30 minutos**, probablemente hay un problema.

---

## 🔍 Comandos de Diagnóstico

### Ver progreso en tiempo real:

```bash
# Ver últimas líneas del log cada 5 segundos
watch -n 5 'tail -10 /tmp/build-frontend-forzado.log'

# Ver todo el log en tiempo real
tail -f /tmp/build-frontend-forzado.log

# Buscar errores en el log
grep -i error /tmp/build-frontend-forzado.log
grep -i "out of memory" /tmp/build-frontend-forzado.log
```

### Ver recursos del sistema:

```bash
# Memoria disponible
free -h

# Uso de CPU
top -bn1 | grep -E "Cpu|docker|node|npm"

# Espacio en disco
df -h

# Procesos de Docker
ps aux | grep docker | grep -v grep
```

---

## 💡 Prevención (Para el Futuro)

### 1. **Usar Actualizaciones Incrementales**

En lugar de rebuild completo, usa actualizaciones incrementales:

```bash
# Rebuild con caché (mucho más rápido)
docker compose build frontend

# Solo si hay problemas, usa --no-cache
docker compose build --no-cache frontend
```

### 2. **Actualizar Solo lo Necesario**

Si solo cambiaste el backend, no necesitas rebuild del frontend:

```bash
./actualizar-solo-backend.sh
```

### 3. **Build en Horarios de Bajo Uso**

Si el VPS está lento durante horas pico, programa el build:

```bash
# Ejecutar a las 3 AM (ejemplo)
echo "0 3 * * * cd /ruta/proyecto && ./forzar-actualizacion-mejorado.sh" | crontab -
```

### 4. **Monitorear Recursos**

Configura alertas si la memoria o disco se llenan:

```bash
# Script simple de monitoreo
free -h | awk 'NR==2{if($7 < 500000) print "ALERTA: Memoria baja"}'
```

---

## 🆘 Si Nada Funciona

### Opción Final: Build Local y Subir Imagen

1. **Construir la imagen en tu máquina local** (más rápida)
2. **Exportar la imagen**:
   ```bash
   docker save gestion-escolar-frontend > frontend-image.tar
   ```
3. **Subir al VPS**:
   ```bash
   scp frontend-image.tar usuario@vps:/ruta/
   ```
4. **Importar en el VPS**:
   ```bash
   ssh usuario@vps
   docker load < frontend-image.tar
   docker compose up -d
   ```

---

## 📚 Scripts Relacionados

- **`forzar-actualizacion-mejorado.sh`** ⭐ - Script mejorado con mejor manejo de timeouts
- **`verificar-build.sh`** - Verifica si el build está activo o colgado
- **`actualizar-solo-backend.sh`** - Actualiza solo backend (más rápido)
- **`diagnostico-vps.sh`** - Diagnóstico completo del sistema

---

## ✅ Resumen Rápido

**¿El build se quedó colgado por 20 minutos?**

1. **Verifica si está activo**:
   ```bash
   ./verificar-build.sh
   # O
   tail -f /tmp/build-frontend-forzado.log
   ```

2. **Si está activo**: **Espera**. El frontend puede tardar 15-30 minutos en VPS lentos.

3. **Si está colgado**:
   ```bash
   # Matar proceso colgado
   pkill -f "docker.*build.*frontend"
   
   # Usar script mejorado
   ./forzar-actualizacion-mejorado.sh
   ```

4. **Si el frontend no es crítico**:
   ```bash
   # Actualizar solo backend
   ./actualizar-solo-backend.sh
   ```

---

**¡Paciencia!** En VPS con recursos limitados, el build puede tardar mucho tiempo. **Es normal** que tarde 15-30 minutos. ⏱️
