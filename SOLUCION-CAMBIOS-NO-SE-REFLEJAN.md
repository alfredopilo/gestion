# 🔧 Solución: Los cambios no se reflejan en el VPS

## 📋 Diagnóstico del Problema

Tu sistema está configurado en **modo producción**, lo que significa:

- ❌ **NO hay volúmenes montados** entre tu código local y los contenedores Docker
- ❌ El código está **dentro de las imágenes Docker**, no sincronizado con archivos locales
- ❌ El frontend usa **build estático con Nginx** (no hay hot-reload)
- ✅ Cualquier cambio requiere **reconstruir las imágenes Docker**

## ⚡ Solución Rápida (Recomendada)

### Opción 1: Usar el script de actualización forzada

He creado un script que hace todo el proceso automáticamente:

```bash
# Dale permisos de ejecución
chmod +x forzar-actualizacion.sh

# Ejecuta el script
./forzar-actualizacion.sh
```

Este script:
- ✅ Detiene los contenedores
- ✅ Reconstruye las imágenes SIN caché (garantiza que se apliquen TODOS los cambios)
- ✅ Verifica la configuración
- ✅ Reinicia los servicios
- ✅ Verifica que todo funcione

**Tiempo: 3-5 minutos**

---

### Opción 2: Usar el script vps-update.sh correctamente

Si ya ejecutaste `update.sh` o `vps-update.sh` pero los cambios no se ven:

```bash
# Ejecuta de nuevo el script
./vps-update.sh

# IMPORTANTE: Selecciona la opción 2 (ACTUALIZACIÓN MEDIA con caché)
# O la opción 3 (ACTUALIZACIÓN COMPLETA sin caché) si hay problemas
```

**Por qué no funcionó antes:**
- Probablemente seleccionaste la opción 1 (RÁPIDA), que **NO funciona con frontend**
- La opción 1 solo funciona si tienes volúmenes montados (modo desarrollo)
- En producción, **SIEMPRE necesitas rebuild** (opción 2 o 3)

---

### Opción 3: Comandos manuales (para usuarios avanzados)

Si prefieres hacerlo manualmente:

```bash
# 1. Detener contenedores
docker compose down

# 2. Reconstruir sin caché (IMPORTANTE: --no-cache)
docker compose build --no-cache backend frontend

# 3. Iniciar servicios
docker compose up -d

# 4. Ver logs para verificar
docker compose logs -f
```

---

## 🔍 Diagnóstico (Si aún no funciona)

Ejecuta el script de diagnóstico:

```bash
chmod +x diagnostico-vps.sh
./diagnostico-vps.sh
```

Este script te dirá exactamente:
- Estado de los contenedores
- Fecha de construcción de las imágenes
- Si hay volúmenes montados
- Archivos modificados recientemente
- Configuración de variables de entorno
- Logs de errores

---

## 📝 Configuración Correcta para VPS

### Archivo `.env` en la raíz del proyecto

**IMPORTANTE**: Si estás en un VPS con IP pública, necesitas configurar esto:

```env
# .env (en la raíz del proyecto GestionEscolar/)

# Reemplaza con la IP de tu VPS
VITE_API_URL=http://TU_IP_VPS:3001/api/v1

# Ejemplo con IP real:
# VITE_API_URL=http://142.93.17.71:3001/api/v1

# O con dominio:
# VITE_API_URL=http://tuescuela.com:3001/api/v1

# Base de datos (opcional, ya tiene valores por defecto)
POSTGRES_USER=gestionscolar
POSTGRES_PASSWORD=gestionscolar2024
POSTGRES_DB=gestion_escolar
POSTGRES_PORT=5434

# Puertos de la aplicación
BACKEND_PORT=3001
FRONTEND_PORT=80

# JWT Secret (CAMBIA ESTO en producción)
JWT_SECRET=mi_secreto_jwt_super_seguro_2024
JWT_EXPIRES_IN=7d
```

**⚠️ DESPUÉS de crear o modificar el `.env`:**

```bash
# DEBES reconstruir para que los cambios se apliquen
docker compose down
docker compose up -d --build
```

---

## 🚫 Errores Comunes

### 1. "Ejecuté update.sh pero no veo cambios"

**Problema**: El script `update.sh` pregunta si quieres reconstruir (opción interactiva)

**Solución**: 
- Cuando te pregunte "¿Deseas reconstruir las imágenes?", responde **S** (Sí)
- O usa directamente `./forzar-actualizacion.sh`

---

### 2. "Cambié el frontend pero sigo viendo lo antiguo"

**Problema**: El navegador tiene caché

**Solución**:
1. Reconstruye el contenedor: `docker compose build --no-cache frontend && docker compose up -d`
2. Limpia la caché del navegador:
   - **Chrome/Edge**: Ctrl+Shift+R (Windows) o Cmd+Shift+R (Mac)
   - **Firefox**: Ctrl+F5 (Windows) o Cmd+Shift+R (Mac)
   - O abre en modo incógnito

---

### 3. "Error de CORS o 'Cannot connect to backend'"

**Problema**: El frontend está intentando conectarse a `localhost` pero estás en un VPS

**Solución**:
1. Crea el archivo `.env` con `VITE_API_URL=http://TU_IP_VPS:3001/api/v1`
2. Reconstruye: `docker compose down && docker compose up -d --build`
3. Verifica que el puerto 3001 esté abierto en el firewall:
   ```bash
   sudo ufw allow 3001/tcp
   sudo ufw allow 80/tcp
   ```

---

### 4. "Los contenedores están corriendo pero no responden"

**Verifica los logs**:

```bash
# Ver todos los logs
docker compose logs -f

# Solo backend
docker compose logs -f backend

# Solo frontend
docker compose logs -f frontend

# Últimas 100 líneas del backend
docker compose logs backend --tail=100
```

**Busca errores comunes**:
- `ECONNREFUSED` → La base de datos no está lista
- `Cannot find module` → Falta instalar dependencias
- `Error: listen EADDRINUSE` → El puerto ya está en uso
- `CORS error` → Problema de configuración de API URL

---

## 📚 Entender el Flujo de Actualización

### Modo Desarrollo (con volúmenes)
```
Cambias código local → Se refleja automáticamente en contenedor → Hot reload
```

### Modo Producción (tu caso actual)
```
Cambias código local → Código NO cambia en contenedor ❌
                     → Necesitas REBUILD → Código actualizado ✅
```

---

## ✅ Checklist de Actualización Exitosa

Después de actualizar, verifica:

- [ ] Los contenedores están corriendo: `docker compose ps`
- [ ] Backend responde: `curl http://localhost:3001/health`
- [ ] Frontend responde: `curl http://localhost`
- [ ] Abrir en navegador y ver cambios (limpia caché)
- [ ] Verificar que no hay errores en logs: `docker compose logs`

---

## 🆘 Si Nada Funciona

1. **Ejecuta el diagnóstico completo**:
   ```bash
   ./diagnostico-vps.sh > diagnostico.txt
   ```

2. **Limpia completamente Docker** (¡CUIDADO! Esto borra TODO):
   ```bash
   # Detener contenedores
   docker compose down -v
   
   # Eliminar imágenes del proyecto
   docker images | grep gestion-escolar | awk '{print $3}' | xargs docker rmi
   
   # Limpiar caché de Docker (opcional)
   docker system prune -a
   
   # Reconstruir desde cero
   docker compose up -d --build
   ```

3. **Verifica permisos de archivos**:
   ```bash
   # Los scripts deben ser ejecutables
   chmod +x *.sh
   ```

4. **Verifica espacio en disco**:
   ```bash
   df -h
   docker system df
   ```

---

## 💡 Recomendaciones para el Futuro

### Para actualizaciones rápidas (solo código):
```bash
./vps-update.sh
# Selecciona opción 2 (MEDIA con caché) - 2-3 minutos
```

### Para cambios en dependencias o Dockerfile:
```bash
./vps-update.sh
# Selecciona opción 3 (COMPLETA sin caché) - 5-10 minutos
```

### Para deploy desde Git:
```bash
./deploy-vps.sh
# Hace git pull + actualización automática
```

### Para problemas persistentes:
```bash
./forzar-actualizacion.sh
# Rebuild forzado garantizado
```

---

## 📞 Más Información

- Ver configuración completa: `cat CONFIGURACION_VPS.md`
- Ver guía de instalación: `cat INSTALACION.md`
- Ver guía rápida VPS: `cat VPS-GUIA-RAPIDA.md`
- Ver instrucciones del VPS: `cat INSTRUCCIONES-VPS.txt`

---

**¿Sigues teniendo problemas?**

Ejecuta `./diagnostico-vps.sh` y envía el resultado para análisis más detallado.
